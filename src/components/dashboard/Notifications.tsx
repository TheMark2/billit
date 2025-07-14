"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconBell, IconBellFilled, IconReceipt, IconCheck, IconX } from "@tabler/icons-react";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
  read: boolean;
  receiptId?: string;
}

interface NotificationsProps {
  onToggle?: (isOpen: boolean) => void;
}

export function Notifications({ onToggle }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    
    if (!uid) return;

    // Obtener recibos recientes para generar notificaciones
    const { data: receipts } = await supabase
      .from("receipts")
      .select("id, proveedor, created_at, estado, metadatos")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    if (receipts) {
      const generatedNotifications: Notification[] = receipts.map((receipt, index) => {
        const isSuccess = receipt.estado === 'synced';
        const timestamp = new Date(receipt.created_at);
        
        return {
          id: `receipt-${receipt.id}`,
          title: isSuccess ? "Recibo procesado" : "Recibo procesado parcialmente",
          message: `${receipt.proveedor} - ${timestamp.toLocaleDateString()}`,
          type: isSuccess ? 'success' : 'warning',
          timestamp,
          read: index > 2, // Marcar como no leídas las primeras 3
          receiptId: receipt.id
        };
      });

      setNotifications(generatedNotifications);
      setHasUnread(generatedNotifications.some(n => !n.read));
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setHasUnread(notifications.some(n => !n.read && n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setHasUnread(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'error': return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case 'warning': return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      default: return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
    }
  };

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    onToggle?.(open);
    
    if (open && hasUnread) {
      // Marcar todas como leídas al abrir
      setTimeout(() => markAllAsRead(), 1000);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleToggle}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors duration-200"
        >
          {hasUnread ? (
            <IconBellFilled className="h-5 w-5 text-neutral-500" />
          ) : (
            <IconBell className="h-5 w-5 text-neutral-500" />
          )}
          
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 ml-4" align="start">
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-neutral-500 hover:text-neutral-700"
                >
                  <IconCheck className="w-3 h-3 mr-1" />
                  Marcar todas como leídas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-1 h-6 w-6 text-neutral-400 hover:text-neutral-600"
              >
                <IconX className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <IconBell className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-sm text-neutral-500">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-neutral-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {notification.title}
                        </p>
                        <span className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                          {formatTimeAgo(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1 truncate">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        

      </PopoverContent>
    </Popover>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Ahora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString();
} 