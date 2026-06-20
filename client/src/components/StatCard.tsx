interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon && (
          <div className="rounded-lg bg-primary-50 p-3 text-primary-600">{icon}</div>
        )}
      </div>
    </div>
  );
}
