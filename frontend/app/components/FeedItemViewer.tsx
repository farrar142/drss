import { FC } from "react";
import { RSSCategory, RSSFeed, RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack } from "@mui/material";

export const FeedItemViewer: FC<{
  items: RSSItem[]
}> = ({ items }) => {
  return <Stack>
    {items.map(item => (
      <div
        key={item.id}
        style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>
        <h3>{item.title}</h3>
        <div dangerouslySetInnerHTML={{ __html: item.description }} />
        <a href={item.link} target="_blank" rel="noopener noreferrer">Read more</a>
      </div>
    ))}
  </Stack>
}
