import Image from 'next/image';

export default function BrandLogo() {
  return (
    <div className="brand-group">
      <Image
        className="brand-mark"
        src="/figtries.png"
        alt="Figtries"
        width={36}
        height={36}
        style={{ width: 'auto', height: '36px', objectFit: 'contain' }}
      />
      <div>
        <p className="brand-name">Procurement</p>
        <p className="brand-sub">&amp; Vendor · Figtries</p>
      </div>
    </div>
  );
}
