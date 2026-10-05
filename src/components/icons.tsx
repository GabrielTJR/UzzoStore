/**
 * Ícones de traço da loja e do painel. Um arquivo só para o traço (1.6) e as
 * pontas arredondadas serem os mesmos em todo lugar — antes cada componente
 * desenhava o seu, com espessuras diferentes lado a lado no cabeçalho.
 *
 * Todos são decorativos (`aria-hidden`): quem dá nome ao controle é o texto ou
 * o `aria-label` do botão/link que os envolve.
 */
type IconProps = { size?: number; className?: string };

function Svg({
  size = 22,
  className,
  children,
  fill = "none",
}: IconProps & { children: React.ReactNode; fill?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7h18M3 12h18M3 17h18" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const IconBag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
  </Svg>
);

export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9l7 7 7-7" />
  </Svg>
);

export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h18M6 12h12M10 18h4" />
  </Svg>
);

export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M1 7h13v9H1zM14 10h4l4 3v3h-8zM6 19a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3zM18 19a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3z" />
  </Svg>
);

export const IconCard = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 6h20v12H2zM2 10h20M6 15h4" />
  </Svg>
);

export const IconSwap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h14l-3-3M20 16H6l3 3" />
  </Svg>
);

export const IconStore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9l1.500-5h15L21 9M4 9v11h16V9M9 20v-6h6v6" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 0-3.500 7.100L21 20l-.8-3.200A8.900 8.900 0 0 0 21 12z" />
  </Svg>
);

/* ---------- painel ---------- */

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11l9-7 9 7M5 10v10h14V10" />
  </Svg>
);

export const IconBox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />
  </Svg>
);

export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1" />
  </Svg>
);

export const IconShirt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3l4 2 4-2 5 4-3 4-2-1v11H8V10l-2 1-3-4z" />
  </Svg>
);

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
  </Svg>
);

export const IconDrop = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z" />
  </Svg>
);

export const IconRuler = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2" />
  </Svg>
);

export const IconLayout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h18v16H3zM3 10h18M9 10v10" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c0-3 3-5 7-5s7 2 7 5M16 5a3.500 3.500 0 0 1 0 7M18 15c2.500.600 4 2.200 4 5" />
  </Svg>
);

export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </Svg>
);

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4H4v16h6M15 8l4 4-4 4M19 12H9" />
  </Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);

export const IconStar = ({
  filled = false,
  ...p
}: IconProps & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3l2.700 5.800 6.300.800-4.600 4.400 1.200 6.300L12 17.200 6.400 20.300l1.200-6.300L3 9.600l6.300-.800z" />
  </Svg>
);
