import Image from "next/image";

export const TchapLogo = () => (
  <span className="hub__tchap-logo" role="img" aria-label="Tchap">
    <span className="hub__tchap-logo__mark" aria-hidden="true">
      <span className="hub__tchap-logo__asset hub__tchap-logo__asset--primary">
        <Image
          src="/assets/tchap-logo-mark-1.svg"
          alt=""
          fill
          sizes="23px"
          priority
          unoptimized
        />
      </span>
      <span className="hub__tchap-logo__asset hub__tchap-logo__asset--secondary">
        <Image
          src="/assets/tchap-logo-mark-2.svg"
          alt=""
          fill
          sizes="15px"
          priority
          unoptimized
        />
      </span>
    </span>
    <span className="hub__tchap-logo__wordmark" aria-hidden="true">
      <Image
        src="/assets/tchap-logo-wordmark.svg"
        alt=""
        fill
        sizes="63px"
        priority
        unoptimized
      />
    </span>
  </span>
);
