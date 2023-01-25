import { SiteMap, SiteMapItemType } from "@peersky/next-web3-chakra/types";

export const SITEMAP: SiteMap = [
  {
    title: "Tools",
    path: "/tools",
    type: SiteMapItemType.EMPTY,
    children: [
      {
        title: "Contracts",
        path: "/contracts",
        type: SiteMapItemType.CONTENT,
      },
      {
        title: "Hash calcualtor",
        path: "/solihash",
        type: SiteMapItemType.EXTERNAL,
      },
    ],
  },
  {
    title: "Developers",
    path: "/developers",
    type: SiteMapItemType.EMPTY,

    children: [
      {
        title: "Docs",
        path: "/docs",
        type: SiteMapItemType.CONTENT,
      },
      {
        title: "Status",
        path: "/status",
        type: SiteMapItemType.CONTENT,
      },
    ],
  },

  {
    title: "About",
    path: "/about",
    type: SiteMapItemType.EMPTY,
    children: [
      {
        title: "Team",
        path: "/team",
        type: SiteMapItemType.CONTENT,
      },
    ],
  },
  {
    title: "Legal",
    path: "/legal",
    type: SiteMapItemType.FOOTER_CATEGORY,
    children: [
      {
        title: "Privacy Policy",
        path: "/privacy-policy",
        type: SiteMapItemType.CONTENT,
      },
      {
        title: "Terms of Service",
        path: "/tos",
        type: SiteMapItemType.CONTENT,
      },
    ],
  },
];