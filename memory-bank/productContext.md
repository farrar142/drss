# Product Context - DRSS

## Why This Project Exists

### Problem Statement
Modern content consumption faces several challenges:
1. **RSS is Limited**: Many websites don't provide RSS feeds or provide incomplete feeds
2. **Content Fragmentation**: Users need to visit multiple sites to get complete information
3. **Manual Monitoring**: Checking multiple sources manually is time-consuming
4. **JavaScript Content**: Many modern sites require JavaScript rendering that traditional RSS can't handle
5. **Inconsistent Formats**: Different sites structure content differently

### Solution Approach
DRSS solves these problems by:
- **Unified Interface**: Single platform for both RSS feeds and web scraping
- **Flexible Extraction**: CSS selector-based content extraction from any website
- **Automated Collection**: Background processing eliminates manual checking
- **Multi-Source Feeds**: Combine multiple sources into single organized feeds
- **Browser Rendering**: Handle JavaScript-heavy sites with Playwright

## How It Should Work

### User Journey
1. **Setup**: User creates account and initial categories
2. **Feed Creation**: User creates feeds within categories
3. **Source Configuration**: User adds sources to feeds (RSS URLs or scraping configs)
4. **Automated Collection**: System automatically collects content in background
5. **Content Consumption**: User browses, reads, and manages collected items
6. **Organization**: User marks items as read/favorite and manages feed organization

### Core Workflows

#### RSS Feed Workflow
1. User provides RSS/Atom URL
2. System validates and tests the feed
3. Background job periodically fetches new items
4. Items appear in user's feed interface
5. User can read, mark as favorite, or mark as read

#### Web Scraping Workflow
1. User provides target URL and CSS selectors
2. System tests scraping configuration
3. Background job periodically scrapes the page
4. Extracted content becomes feed items
5. User consumes content like traditional RSS

#### Detail Page Scraping Workflow
1. User configures list page scraping (finds article links)
2. User configures detail page scraping (extracts full content)
3. System scrapes list page to find article URLs
4. System visits each article URL to extract full content
5. Rich, complete articles appear in user's feed

### User Experience Goals

#### Simplicity
- **One-Click Setup**: RSS feeds should work with just a URL
- **Visual Selector Builder**: Scraping setup should be intuitive
- **Automatic Testing**: System validates configurations immediately
- **Clear Feedback**: Users always know if something is working or broken

#### Reliability
- **Consistent Updates**: Content appears predictably
- **Error Handling**: Clear messages when sources fail
- **Fallback Options**: Multiple sources prevent single points of failure
- **Status Monitoring**: Users can see collection job results

#### Flexibility
- **Custom Organization**: Users control categories and feed structure
- **Multiple Sources**: Single feeds can aggregate multiple sources
- **Selective Reading**: Fine-grained read/favorite status
- **Export Options**: Users can export their data

## Target Users

### Primary Users
- **Content Curators**: People who monitor multiple sources for work or research
- **News Enthusiasts**: Users who want comprehensive coverage from multiple sources
- **Researchers**: People tracking specific topics across various websites
- **Bloggers/Writers**: Content creators who need to monitor their niche

### Use Cases
- **Industry Monitoring**: Track competitor blogs, news sites, and forums
- **Research Aggregation**: Collect academic papers, reports, and articles
- **News Consumption**: Combine traditional news with blog posts and social content
- **Hobby Tracking**: Follow specialized communities and content creators

## Success Metrics
- **User Retention**: Users continue using the system over time
- **Content Volume**: System successfully collects content from diverse sources
- **Error Rate**: Low failure rate for both RSS and scraping sources
- **User Satisfaction**: Positive feedback on ease of use and reliability
- **Source Diversity**: Users successfully configure various types of sources
