import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface ReceiptDetailsProps {
  receipt: {
    id: string;
    date: string;
    provider: string;
    documentType: string;
    total: number;
  };
  trigger: React.ReactNode;
}

export function ReceiptDetails({ receipt, trigger }: ReceiptDetailsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Detalles del documento</h4>
            <p className="text-sm text-muted-foreground">
              Información completa del documento seleccionado
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm">ID</span>
              <span className="col-span-2 text-sm font-medium">{receipt.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm">Fecha</span>
              <span className="col-span-2 text-sm font-medium">
                {new Date(receipt.date).toLocaleDateString()}
              </span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm">Proveedor</span>
              <span className="col-span-2 text-sm font-medium">{receipt.provider}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-sm">Total</span>
              <span className="col-span-2 text-sm font-medium">{formatCurrency(receipt.total)}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 