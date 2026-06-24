// Small conceptual icons for each upload stage — currentColor stroke, no emoji.
// Keyed by the stage's `icon` field in lib/backends.

const P = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg {...P} width={size} height={size} aria-hidden>
      {children}
    </svg>
  );
}

export function StageIcon({ name, size = 22 }: { name: string; size?: number }) {
  switch (name) {
    // a square file chopped into a grid of tiles
    case "grid":
      return (
        <Svg size={size}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />
        </Svg>
      );
    // a tiny signed payment hopping from one point to another
    case "tx":
      return (
        <Svg size={size}>
          <circle cx="5" cy="12" r="2.2" />
          <circle cx="19" cy="12" r="2.2" />
          <path d="M7.4 11.2 16.6 11.2M14.6 9.4l2 1.8-2 1.8" />
        </Svg>
      );
    // finality — agreement locked in
    case "finality":
      return (
        <Svg size={size}>
          <path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </Svg>
      );
    // anchor — a small commitment that holds the whole thing
    case "anchor":
      return (
        <Svg size={size}>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v12M6 12a6 6 0 0 0 12 0M5 12h2M17 12h2" />
        </Svg>
      );
    // erasure-coded shards with redundancy
    case "shards":
      return (
        <Svg size={size}>
          <path d="M12 3v18M3 8l9 4 9-4M3 16l9-4 9 4" />
        </Svg>
      );
    // one source distributing to many nodes
    case "distribute":
      return (
        <Svg size={size}>
          <circle cx="12" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="M12 7v3M12 10 6 17M12 10v7M12 10l6 7" />
        </Svg>
      );
    // a certificate / on-chain proof
    case "certificate":
      return (
        <Svg size={size}>
          <rect x="5" y="3" width="14" height="13" rx="1.5" />
          <path d="M8 7h8M8 10h5" />
          <circle cx="12" cy="18" r="3" />
          <path d="M10.5 20.5 9.5 23l2.5-1.3L14.5 23l-1-2.5" />
        </Svg>
      );
    // content fingerprint (content-addressing)
    case "fingerprint":
      return (
        <Svg size={size}>
          <path d="M12 5a7 7 0 0 1 7 7M5 12a7 7 0 0 1 7-7" />
          <path d="M8.5 12a3.5 3.5 0 0 1 7 0v2.5M12 12v4M15.5 14.5V17" />
          <path d="M8.5 14v2a8 8 0 0 0 .6 3" />
        </Svg>
      );
    // local node / disk write
    case "drive":
      return (
        <Svg size={size}>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <circle cx="8" cy="12" r="1" />
          <path d="M12 12h6" />
        </Svg>
      );
    // announce to the network / pin
    case "broadcast":
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="2" />
          <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6 6a8 8 0 0 0 0 12M18 6a8 8 0 0 1 0 12" />
        </Svg>
      );
    // single upload to a bucket
    case "upload":
      return (
        <Svg size={size}>
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </Svg>
      );
    // replicated copies across data centers
    case "copies":
      return (
        <Svg size={size}>
          <rect x="4" y="4" width="12" height="12" rx="1.5" />
          <path d="M8 20h10a2 2 0 0 0 2-2V8" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="8" />
        </Svg>
      );
  }
}
