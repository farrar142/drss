"""
Browser-based web crawler using Browserless.io service via WebSocket.

This module provides functions to fetch web pages using Chrome DevTools Protocol (CDP)
over WebSocket to bypass bot detection and anti-scraping measures.

Requires the browserless service to be running (see compose.yml).

CDP Protocol Reference:
    - Page.navigate: Navigate to URL
    - Page.getFrameTree: Get frame structure
    - Runtime.evaluate: Execute JavaScript in page context
    - DOM.getDocument: Get document root
    - DOM.getOuterHTML: Get HTML content
"""

import os
import json
import asyncio
import logging
from typing import Optional, Any, Dict, Callable, Awaitable
from dataclasses import dataclass

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

from .base import BaseBrowserCrawler
from .abstract import CrawlResult, WaitUntil

logger = logging.getLogger(__name__)


@dataclass
class CDPResponse:
    """Response from CDP command"""
    id: int
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class CDPSession:
    """
    Chrome DevTools Protocol session over WebSocket.

    Manages a WebSocket connection to browserless and provides
    methods for sending CDP commands and receiving responses.
    """

    def __init__(self, ws_url: str, timeout: float = 30.0):
        """
        Initialize CDP session.

        Args:
            ws_url: WebSocket URL for browserless (e.g., ws://browserless:3000)
            timeout: Default timeout for operations in seconds
        """
        self.ws_url = ws_url
        self.timeout = timeout
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._message_id = 0
        self._session_id: Optional[str] = None
        self._pending_responses: Dict[int, asyncio.Future] = {}
        self._event_handlers: Dict[str, Callable[[Dict], Awaitable[None]]] = {}
        self._receive_task: Optional[asyncio.Task] = None
        self._connected = False

    async def connect(self) -> None:
        """Establish WebSocket connection to browserless."""
        if self._connected:
            return

        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(
                    self.ws_url,
                    max_size=50 * 1024 * 1024,  # 50MB max message size
                    ping_interval=20,
                    ping_timeout=10,
                ),
                timeout=self.timeout
            )
            self._connected = True
            self._receive_task = asyncio.create_task(self._receive_loop())
            logger.debug(f"Connected to browserless at {self.ws_url}")
        except asyncio.TimeoutError:
            raise ConnectionError(f"Timeout connecting to browserless at {self.ws_url}")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to browserless: {e}")

    async def disconnect(self) -> None:
        """Close WebSocket connection."""
        self._connected = False

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._ws:
            await self._ws.close()
            self._ws = None

        # Cancel all pending responses
        for future in self._pending_responses.values():
            if not future.done():
                future.cancel()
        self._pending_responses.clear()

        logger.debug("Disconnected from browserless")

    async def _receive_loop(self) -> None:
        """Background task to receive and dispatch messages."""
        try:
            while self._connected and self._ws:
                try:
                    message = await self._ws.recv()
                    data = json.loads(message)
                    await self._handle_message(data)
                except ConnectionClosedOK:
                    logger.debug("WebSocket connection closed normally")
                    break
                except ConnectionClosedError as e:
                    logger.warning(f"WebSocket connection closed with error: {e}")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
        except asyncio.CancelledError:
            pass
        finally:
            self._connected = False

    async def _handle_message(self, data: Dict) -> None:
        """Handle incoming CDP message."""
        if "id" in data:
            # Response to a command
            msg_id = data["id"]
            if msg_id in self._pending_responses:
                future = self._pending_responses.pop(msg_id)
                if not future.done():
                    if "error" in data:
                        future.set_result(CDPResponse(
                            id=msg_id,
                            error=data["error"]
                        ))
                    else:
                        future.set_result(CDPResponse(
                            id=msg_id,
                            result=data.get("result", {})
                        ))
        elif "method" in data:
            # Event
            method = data["method"]
            if method in self._event_handlers:
                try:
                    await self._event_handlers[method](data.get("params", {}))
                except Exception as e:
                    logger.error(f"Error handling event {method}: {e}")

    def on_event(self, method: str, handler: Callable[[Dict], Awaitable[None]]) -> None:
        """Register an event handler."""
        self._event_handlers[method] = handler

    async def send(
        self,
        method: str,
        params: Optional[Dict] = None,
        timeout: Optional[float] = None
    ) -> CDPResponse:
        """
        Send a CDP command and wait for response.

        Args:
            method: CDP method name (e.g., "Page.navigate")
            params: Method parameters
            timeout: Timeout in seconds (uses default if not specified)

        Returns:
            CDPResponse with result or error
        """
        if not self._connected or not self._ws:
            raise ConnectionError("Not connected to browserless")

        self._message_id += 1
        msg_id = self._message_id

        message = {
            "id": msg_id,
            "method": method,
        }
        if params:
            message["params"] = params
        if self._session_id:
            message["sessionId"] = self._session_id

        future: asyncio.Future[CDPResponse] = asyncio.get_event_loop().create_future()
        self._pending_responses[msg_id] = future

        try:
            await self._ws.send(json.dumps(message))
            response = await asyncio.wait_for(
                future,
                timeout=timeout or self.timeout
            )
            return response
        except asyncio.TimeoutError:
            self._pending_responses.pop(msg_id, None)
            raise TimeoutError(f"Timeout waiting for response to {method}")
        except Exception as e:
            self._pending_responses.pop(msg_id, None)
            raise

    async def attach_to_target(self, target_id: str) -> str:
        """
        Attach to a browser target.

        Args:
            target_id: Target ID to attach to

        Returns:
            Session ID for the attached target
        """
        response = await self.send("Target.attachToTarget", {
            "targetId": target_id,
            "flatten": True
        })

        if response.error:
            raise RuntimeError(f"Failed to attach to target: {response.error}")

        self._session_id = response.result.get("sessionId")
        return self._session_id


class BrowserlessPage:
    """
    High-level page interface for browserless.

    Provides Puppeteer-like methods for browser automation.
    """

    def __init__(self, session: CDPSession):
        """
        Initialize page.

        Args:
            session: CDP session to use
        """
        self._session = session
        self._frame_id: Optional[str] = None
        self._load_event = asyncio.Event()
        self._network_idle_event = asyncio.Event()
        self._pending_requests = 0

    async def enable_events(self) -> None:
        """Enable necessary CDP domains."""
        await self._session.send("Page.enable")
        await self._session.send("DOM.enable")
        await self._session.send("Runtime.enable")
        await self._session.send("Network.enable")

        # Set up event handlers
        self._session.on_event("Page.loadEventFired", self._on_load)
        self._session.on_event("Page.frameStoppedLoading", self._on_frame_stopped)
        self._session.on_event("Network.requestWillBeSent", self._on_request_start)
        self._session.on_event("Network.loadingFinished", self._on_request_end)
        self._session.on_event("Network.loadingFailed", self._on_request_end)

    async def _on_load(self, params: Dict) -> None:
        """Handle page load event."""
        self._load_event.set()

    async def _on_frame_stopped(self, params: Dict) -> None:
        """Handle frame stopped loading."""
        pass

    async def _on_request_start(self, params: Dict) -> None:
        """Handle network request start."""
        self._pending_requests += 1
        self._network_idle_event.clear()

    async def _on_request_end(self, params: Dict) -> None:
        """Handle network request end."""
        self._pending_requests = max(0, self._pending_requests - 1)
        if self._pending_requests <= 2:
            self._network_idle_event.set()

    async def goto(
        self,
        url: str,
        wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
        timeout: float = 30.0
    ) -> None:
        """
        Navigate to a URL.

        Args:
            url: URL to navigate to
            wait_until: Wait condition
            timeout: Navigation timeout in seconds
        """
        self._load_event.clear()
        self._network_idle_event.clear()

        # Navigate
        response = await self._session.send("Page.navigate", {
            "url": url
        }, timeout=timeout)

        if response.error:
            raise RuntimeError(f"Navigation failed: {response.error}")

        self._frame_id = response.result.get("frameId")

        # Wait based on condition
        try:
            if wait_until == WaitUntil.LOAD:
                await asyncio.wait_for(self._load_event.wait(), timeout=timeout)
            elif wait_until == WaitUntil.DOMCONTENTLOADED:
                # DOMContentLoaded fires before load
                await asyncio.wait_for(self._load_event.wait(), timeout=timeout)
            elif wait_until in (WaitUntil.NETWORKIDLE0, WaitUntil.NETWORKIDLE2):
                # Wait for load first, then network idle
                await asyncio.wait_for(self._load_event.wait(), timeout=timeout)
                # Give a small delay for network activity to settle
                await asyncio.sleep(0.5)
                # Wait for network idle (with additional timeout)
                try:
                    await asyncio.wait_for(
                        self._network_idle_event.wait(),
                        timeout=min(timeout, 5.0)
                    )
                except asyncio.TimeoutError:
                    # Network idle timeout is not fatal
                    logger.debug("Network idle timeout, continuing anyway")
        except asyncio.TimeoutError:
            raise TimeoutError(f"Navigation timeout for {url}")

    async def wait_for_selector(
        self,
        selector: str,
        timeout: float = 30.0
    ) -> bool:
        """
        Wait for a selector to appear in the page.

        Args:
            selector: CSS selector
            timeout: Timeout in seconds

        Returns:
            True if selector found, False otherwise
        """
        start_time = asyncio.get_event_loop().time()

        while (asyncio.get_event_loop().time() - start_time) < timeout:
            # Check if element exists
            response = await self._session.send("Runtime.evaluate", {
                "expression": f"document.querySelector('{selector}') !== null",
                "returnByValue": True
            })

            if response.error:
                logger.warning(f"Error checking selector: {response.error}")
            elif response.result.get("result", {}).get("value"):
                return True

            await asyncio.sleep(0.1)

        return False

    async def evaluate(self, expression: str) -> Any:
        """
        Evaluate JavaScript in the page context.

        Args:
            expression: JavaScript expression to evaluate

        Returns:
            Result of the evaluation
        """
        response = await self._session.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True
        })

        if response.error:
            raise RuntimeError(f"Evaluation failed: {response.error}")

        result = response.result.get("result", {})

        if result.get("type") == "undefined":
            return None

        return result.get("value")

    async def content(self) -> str:
        """
        Get the full HTML content of the page.

        Returns:
            HTML content as string
        """
        # Get document root
        doc_response = await self._session.send("DOM.getDocument", {
            "depth": 0
        })

        if doc_response.error:
            raise RuntimeError(f"Failed to get document: {doc_response.error}")

        root_node_id = doc_response.result.get("root", {}).get("nodeId")

        # Get outer HTML
        html_response = await self._session.send("DOM.getOuterHTML", {
            "nodeId": root_node_id
        })

        if html_response.error:
            raise RuntimeError(f"Failed to get HTML: {html_response.error}")

        return html_response.result.get("outerHTML", "")

    async def query_selector_html(self, selector: str) -> Optional[str]:
        """
        Get HTML content of an element matching the selector.

        Args:
            selector: CSS selector

        Returns:
            HTML content of the element, or None if not found
        """
        # Use JavaScript to get the outer HTML of the selector
        html = await self.evaluate(f"""
            (() => {{
                const el = document.querySelector('{selector}');
                return el ? el.outerHTML : null;
            }})()
        """)
        return html


class BrowserlessClient:
    """
    High-level client for browserless service.

    Manages browser contexts and pages.
    """

    def __init__(self, ws_url: str, timeout: float = 30.0):
        """
        Initialize browserless client.

        Args:
            ws_url: WebSocket URL for browserless
            timeout: Default timeout for operations
        """
        self.ws_url = ws_url
        self.timeout = timeout
        self._session: Optional[CDPSession] = None

    async def __aenter__(self) -> "BrowserlessClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.disconnect()

    async def connect(self) -> None:
        """Connect to browserless and create a browser context."""
        self._session = CDPSession(self.ws_url, timeout=self.timeout)
        await self._session.connect()

        # Get browser contexts
        response = await self._session.send("Target.getBrowserContexts")
        logger.debug(f"Browser contexts: {response.result}")

    async def disconnect(self) -> None:
        """Disconnect from browserless."""
        if self._session:
            await self._session.disconnect()
            self._session = None

    async def new_page(self) -> BrowserlessPage:
        """
        Create a new page.

        Returns:
            BrowserlessPage instance
        """
        if not self._session:
            raise RuntimeError("Not connected to browserless")

        # Create new target (page)
        response = await self._session.send("Target.createTarget", {
            "url": "about:blank"
        })

        if response.error:
            raise RuntimeError(f"Failed to create page: {response.error}")

        target_id = response.result.get("targetId")

        # Attach to the target
        await self._session.attach_to_target(target_id)

        # Create page wrapper
        page = BrowserlessPage(self._session)
        await page.enable_events()

        return page

    async def close_page(self, page: BrowserlessPage) -> None:
        """
        Close a page.

        Args:
            page: Page to close
        """
        # In CDP, closing the target closes the page
        # This would require tracking target_id per page
        pass


class BrowserlessCrawler(BaseBrowserCrawler):
    """
    Browser-based crawler that uses Browserless.io service
    via WebSocket and Chrome DevTools Protocol.
    """

    def __init__(
        self,
        service_url: Optional[str] = None,
        timeout: int = 30000,
        default_wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
        default_selector: str = "body",
    ):
        """
        Initialize the browserless crawler.

        Args:
            service_url: WebSocket URL of the browserless service.
                        Defaults to BROWSERLESS_SERVICE env var or ws://browserless:3000
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        # Convert HTTP URL to WebSocket URL if needed
        service_url = service_url or os.getenv(
            "BROWSERLESS_SERVICE", "ws://browserless:3000"
        )

        if service_url.startswith("http://"):
            service_url = service_url.replace("http://", "ws://")
        elif service_url.startswith("https://"):
            service_url = service_url.replace("https://", "wss://")

        super().__init__(
            service_url=service_url,
            timeout=timeout,
            default_wait_until=default_wait_until,
            default_selector=default_selector,
        )

    def fetch_html_raw(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Fetch HTML content from a URL using browserless.

        This is the raw implementation without caching or retry logic.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for before capturing content
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers (not supported via CDP directly)

        Returns:
            CrawlResult with success status and HTML content or error message
        """
        # Run the async fetch in a new event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context, create a new thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self._fetch_html_async(url, selector, wait_until, timeout, headers)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(
                    self._fetch_html_async(url, selector, wait_until, timeout, headers)
                )
        except RuntimeError:
            # No event loop, create one
            return asyncio.run(
                self._fetch_html_async(url, selector, wait_until, timeout, headers)
            )

    async def _fetch_html_async(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Async implementation of HTML fetching.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers

        Returns:
            CrawlResult with HTML content
        """
        timeout_sec = (timeout or self.timeout) / 1000.0
        selector = selector or self.default_selector
        wait_until = wait_until or self.default_wait_until

        client = BrowserlessClient(self.ws_url, timeout=timeout_sec)

        try:
            async with client:
                page = await client.new_page()

                # Set custom headers if provided
                if headers:
                    await self._set_extra_headers(page, headers)

                # Navigate to URL
                await page.goto(url, wait_until=wait_until, timeout=timeout_sec)

                # Wait for selector if specified
                if selector and selector != "body":
                    found = await page.wait_for_selector(selector, timeout=timeout_sec)
                    if not found:
                        logger.warning(f"Selector '{selector}' not found on {url}")

                # Get HTML content
                html = await page.content()

                return CrawlResult(
                    success=True,
                    html=html,
                    url=url,
                    from_cache=False,
                )

        except TimeoutError as e:
            logger.error(f"Timeout fetching {url}: {e}")
            return CrawlResult(
                success=False,
                error=f"Timeout: {str(e)}",
                url=url,
            )
        except ConnectionError as e:
            logger.error(f"Connection error fetching {url}: {e}")
            return CrawlResult(
                success=False,
                error=f"Connection error: {str(e)}",
                url=url,
            )
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return CrawlResult(
                success=False,
                error=str(e),
                url=url,
            )

    async def _set_extra_headers(self, page: BrowserlessPage, headers: Dict[str, str]) -> None:
        """
        Set extra HTTP headers for requests.

        Args:
            page: Page to set headers on
            headers: Headers to set
        """
        # Use Network.setExtraHTTPHeaders
        await page._session.send("Network.setExtraHTTPHeaders", {
            "headers": headers
        })

    @property
    def ws_url(self) -> str:
        """Get the WebSocket URL."""
        return self.service_url


# Async convenience functions
async def fetch_html_async(
    url: str,
    ws_url: str = "ws://browserless:3000",
    selector: str = "body",
    wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
    timeout: float = 30.0,
    headers: Optional[Dict[str, str]] = None,
) -> CrawlResult:
    """
    Async function to fetch HTML using browserless.

    This is a convenience function for async code.

    Args:
        url: URL to fetch
        ws_url: WebSocket URL for browserless
        selector: CSS selector to wait for
        wait_until: Wait condition
        timeout: Timeout in seconds
        headers: Custom headers

    Returns:
        CrawlResult with HTML content
    """
    crawler = BrowserlessCrawler(service_url=ws_url, timeout=int(timeout * 1000))
    return await crawler._fetch_html_async(
        url=url,
        selector=selector,
        wait_until=wait_until,
        timeout=int(timeout * 1000),
        headers=headers,
    )


# Test code
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.DEBUG)

    async def test():
        """Test the browserless crawler."""
        url = sys.argv[1] if len(sys.argv) > 1 else "https://news.ycombinator.com"
        ws_url = sys.argv[2] if len(sys.argv) > 2 else "ws://localhost:3000"

        print(f"Fetching {url} via {ws_url}...")

        result = await fetch_html_async(
            url=url,
            ws_url=ws_url,
            selector="body",
            wait_until=WaitUntil.NETWORKIDLE2,
            timeout=30.0,
        )

        if result.success:
            print(f"Success! HTML length: {len(result.html)}")
            print(f"First 500 chars:\n{result.html[:500]}")
        else:
            print(f"Error: {result.error}")

    asyncio.run(test())
