import React from 'react';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', children }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}>
      {children}
    </div>
  );
};

export const PricingCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col gap-6 border border-neutral-200">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      
      <div className="flex items-baseline gap-1">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
};

export const PricingSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-3xl animate-fade-in">
      <div className="flex flex-col gap-10 p-8 min-h-[calc(100vh-theme(spacing.6)*4)]">
        
        <Skeleton className="h-8 w-64 mx-auto" />
        
        {/* Selector de ciclo skeleton */}
        <div className="flex justify-center">
          <Skeleton className="h-10 w-64 rounded-full" />
        </div>
        
        {/* Tarjetas de planes skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <PricingCardSkeleton />
          <PricingCardSkeleton />
          <PricingCardSkeleton />
        </div>

        {/* Tarjeta empresarial skeleton */}
        <div className="flex justify-center mt-8">
          <div className="w-full max-w-sm">
            <PricingCardSkeleton />
          </div>
        </div>

        
      </div>
    </div>
  );
}; 