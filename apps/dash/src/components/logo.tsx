import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  title?: string;
}

// Uses the original SVG paths and gradients. Only adds sizing + optional title.
export const Logo = forwardRef<SVGSVGElement, LogoProps>(
  ({ size = 24, className, title = "Logo", ...props }, ref) => {
    return (
      <svg
        aria-label={title}
        className={cn(className)}
        fill="none"
        height={size}
        ref={ref}
        role="img"
        viewBox="0 0 200 200"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <mask
          height="200"
          id="mask0_2001_3"
          mask-type="luminance"
          maskUnits="userSpaceOnUse"
          width="200"
          x="0"
          y="0"
        >
          <path
            d="M150 0H50C22.3858 0 0 22.3858 0 50V150C0 177.614 22.3858 200 50 200H150C177.614 200 200 177.614 200 150V50C200 22.3858 177.614 0 150 0Z"
            fill="white"
          />
        </mask>
        <g mask="url(#mask0_2001_3)">
          <path
            d="M150 0H50C22.3858 0 0 22.3858 0 50V150C0 177.614 22.3858 200 50 200H150C177.614 200 200 177.614 200 150V50C200 22.3858 177.614 0 150 0Z"
            fill="#A3004C"
          />
          <path d="M0 0H200V200H0V0Z" fill="url(#paint0_linear_2001_3)" />
          <path
            d="M81.25 50L97.16 84.09L131.25 100L97.16 115.91L81.25 150L65.34 115.91L31.25 100L65.34 84.09L81.25 50Z"
            fill="url(#paint1_linear_2001_3)"
          />
          <path
            d="M93.8966 122.902L113.752 119.485L125.002 150L136.252 119.485L168.304 125L147.502 100L168.304 75L136.252 80.5146L125.002 50L113.752 80.5146L93.8966 77.0983L97.1595 84.09L131.25 100L97.1595 115.91L93.8966 122.902Z"
            fill="url(#paint2_linear_2001_3)"
            opacity="0.5"
          />
        </g>
        <path
          d="M150 4.16663H50.0001C24.687 4.16663 4.16675 24.6869 4.16675 50V150C4.16675 175.313 24.687 195.833 50.0001 195.833H150C175.313 195.833 195.833 175.313 195.833 150V50C195.833 24.6869 175.313 4.16663 150 4.16663Z"
          stroke="url(#paint3_linear_2001_3)"
          strokeWidth="2"
        />
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="paint0_linear_2001_3"
            x1="100"
            x2="108.333"
            y1="4.09782e-06"
            y2="200"
          >
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="paint1_linear_2001_3"
            x1="81.25"
            x2="81.25"
            y1="50"
            y2="150"
          >
            <stop stopColor="white" stopOpacity="0.8" />
            <stop offset="1" stopColor="white" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="paint2_linear_2001_3"
            x1="131.1"
            x2="131.1"
            y1="50"
            y2="150"
          >
            <stop stopColor="white" stopOpacity="0.8" />
            <stop offset="1" stopColor="white" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="paint3_linear_2001_3"
            x1="100"
            x2="100"
            y1="-4.06795e-05"
            y2="200"
          >
            <stop stopColor="white" stopOpacity="0.12" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
);

Logo.displayName = "Logo";
