export default function GuitarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m11.5 8.5 4 4" />
      <path d="m14 6.5 3.5-3.5a1.2 1.2 0 0 1 1.7 0l1.3 1.3a1.2 1.2 0 0 1 0 1.7L17 9.5" />
      <path d="M16 11 8 19c-1.3 1.3-4.5 3-4.5 3s1.7-3.2 3-4.5l8-8" />
      <circle cx="10" cy="14" r="2.5" />
    </svg>
  );
}
