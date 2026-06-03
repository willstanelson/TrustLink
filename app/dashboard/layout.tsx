import KYCGate from '@/components/KYCGate';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <KYCGate>
      {/* Any standard dashboard wrapper styling goes here */}
      <div className="dashboard-content w-full h-full">
        {children}
      </div>
    </KYCGate>
  );
}