import React from "react";

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-neutral-50 animate-pulse">
      <div className="flex items-center gap-3">
        {/* Avatar skeleton */}
        <div className="h-10 w-10 bg-neutral-200 rounded-full" />
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          {/* Nombre skeleton */}
          <div className="h-4 bg-neutral-200 rounded w-20" />
          {/* Email skeleton */}
          <div className="h-3 bg-neutral-100 rounded w-24" />
        </div>
      </div>
      
      {/* Plan badge skeleton */}
      <div className="flex items-center justify-center">
        <div className="h-6 bg-neutral-200 rounded-full w-20" />
      </div>
      
      {/* Botón cerrar sesión skeleton */}
      <div className="h-8 bg-neutral-200 rounded-md w-full" />
    </div>
  );
}

export function NumberSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="h-4 bg-neutral-200 rounded w-24" />
          <div className="h-6 bg-neutral-100 rounded w-16" />
        </div>
        <div className="flex flex-col min-w-[120px] gap-1">
          <div className="h-3 bg-neutral-200 rounded w-20" />
          <div className="h-4 bg-neutral-100 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-neutral-200 rounded w-48" />
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-24" />
            <div className="h-6 bg-neutral-100 rounded w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReceiptsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 bg-neutral-200 rounded w-40" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-4">
            <div className="h-4 bg-neutral-100 rounded w-full col-span-1" />
            <div className="h-4 bg-neutral-100 rounded w-full col-span-1" />
            <div className="h-4 bg-neutral-100 rounded w-full col-span-1" />
            <div className="h-4 bg-neutral-100 rounded w-full col-span-1" />
            <div className="h-4 bg-neutral-100 rounded w-full col-span-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyInfoSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-neutral-200 rounded w-32" />
      <div className="h-6 bg-neutral-100 rounded w-48" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-4 bg-neutral-100 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

export function PlanStatusSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-5 bg-neutral-200 rounded w-24" />
      <div className="space-y-3">
        <div className="h-4 bg-neutral-100 rounded w-32" />
        <div className="h-4 bg-neutral-100 rounded w-28" />
        <div className="h-8 bg-neutral-100 rounded w-full" />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="bg-white p-6 rounded-3xl">
      <div className="animate-pulse space-y-8 p-8">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="grid grid-cols-[350px_1fr] gap-10">
            <div className="space-y-2">
              <div className="h-5 bg-neutral-200 rounded w-32" />
              <div className="h-4 bg-neutral-100 rounded w-48" />
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-neutral-100 rounded w-full" />
              <div className="h-10 bg-neutral-100 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton para la tabla de recibos específicamente
export const ReceiptsTableSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-lg">
      <table className="w-full caption-bottom text-sm">
        {/* Header de la tabla */}
        <thead>
          <tr className="bg-neutral-50 border-0">
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-8 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-4 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-36 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-12 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-64 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-48 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-8 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-36 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-10 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-neutral-500 w-10 first:rounded-l-lg last:rounded-r-lg">
              <div className="w-4 h-4 bg-neutral-200 rounded animate-pulse" />
            </th>
          </tr>
        </thead>
        {/* Body de la tabla con 7 filas */}
        <tbody>
          {Array.from({ length: 7 }, (_, i) => (
            <tr key={i} className="border-b transition-colors">
              {/* Checkbox */}
              <td className="py-4 px-4 align-middle w-8">
                <div className="w-4 h-4 bg-neutral-200 rounded animate-pulse" />
              </td>
              {/* Fecha */}
              <td className="py-4 px-4 align-middle whitespace-nowrap">
                <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse" />
              </td>
              {/* Proveedor */}
              <td className="py-4 px-4 align-middle max-w-[200px]">
                <div className="w-32 h-4 bg-neutral-200 rounded animate-pulse" />
              </td>
              {/* Tipo (Badge) */}
              <td className="py-4 px-4 align-middle whitespace-nowrap">
                <div className="flex items-center gap-2 pl-2 w-fit">
                  <div className="w-2 h-2 bg-neutral-300 rounded-full animate-pulse" />
                  <div className="w-16 h-5 bg-neutral-200 rounded-full animate-pulse" />
                </div>
              </td>
              {/* Total */}
              <td className="py-4 px-4 align-middle whitespace-nowrap">
                <div className="w-16 h-4 bg-neutral-200 rounded animate-pulse" />
              </td>
              {/* Acciones */}
              <td className="py-4 px-4 align-middle whitespace-nowrap">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse" />
                  <div className="w-18 h-4 bg-neutral-200 rounded animate-pulse" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 