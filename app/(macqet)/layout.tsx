import PortalNav from '@/components/portal/PortalNav';

export default function MacqetPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PortalNav />
      {children}
    </>
  );
}
