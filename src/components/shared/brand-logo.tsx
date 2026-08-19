import Image from "next/image";

export function BrandLogo({ className }: Readonly<{ className?: string }>) {
  return (
    <Image
      src="/mascot/logo.png"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={className}
    />
  );
}
