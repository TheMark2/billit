# 🗂️ Sistema de Organización de Tickets

## ✨ Funcionalidades Implementadas

### 🎨 **Diseño TreeView (Estilo Preline)**
- **Estructura HTML idéntica** al ejemplo de Preline UI
- **Líneas conectoras** automáticas entre carpetas padre e hijas
- **Animaciones suaves** de expand/collapse
- **Selección visual** con backgrounds adaptativos

### 🖱️ **Drag & Drop Avanzado**
- **Arrastrar tickets** desde el panel derecho
- **Soltar en cualquier carpeta** del árbol (incluida "Todos")
- **Feedback visual** durante el arrastre
- **Actualización automática** de contadores

### 📁 **Gestión Jerárquica de Carpetas**
- **Carpetas anidadas** con múltiples niveles
- **Conteo automático** de tickets por carpeta
- **Estados persistentes** (expandido/colapsado)
- **Iconos personalizables** con SVG paths

### 🔄 **Sincronización en Tiempo Real**
- **Recarga automática** después de mover tickets
- **Actualización de contadores** inmediata
- **Estado persistente** en base de datos
- **Sin pérdida de estado** al navegar

## 🚀 Páginas y Componentes

### `/dashboard/organizar-tickets`
**Página principal de organización:**
- Panel izquierdo: TreeView de carpetas
- Panel derecho: Lista de tickets arrastrables
- Búsqueda en tiempo real
- Creación de carpetas con modal

### Endpoints API
- `GET /api/ticket-folders` - Obtener jerarquía de carpetas
- `POST /api/ticket-folders` - Crear nueva carpeta
- `PUT /api/ticket-folders` - Actualizar carpeta (expand/collapse, editar)
- `DELETE /api/ticket-folders` - Eliminar carpeta
- `POST /api/move-tickets` - Mover tickets entre carpetas

## 🗄️ Estructura de Base de Datos

### Tabla `ticket_folders`
```sql
- id: UUID (PK)
- user_id: UUID (FK a auth.users)
- name: VARCHAR(255)
- description: TEXT
- parent_id: UUID (FK autoreferencial)
- icon_name: VARCHAR(50)
- color: VARCHAR(20)
- is_expanded: BOOLEAN
- "position": INTEGER (palabra reservada escapada)
- created_at/updated_at: TIMESTAMP
```

### Tabla `receipts` (actualizada)
```sql
- folder_id: UUID (FK a ticket_folders) -- NUEVA COLUMNA
```

### Funciones SQL Implementadas
- `get_folder_hierarchy()` - Consulta recursiva para árbol completo
- `move_tickets_to_folder()` - Mover tickets con validación
- `reorder_folders()` - Reorganizar posiciones
- `update_folder_updated_at()` - Trigger automático

## 🎯 Carpetas por Defecto

Cada usuario obtiene automáticamente:
1. **📥 Sin categorizar** (gris) - Tickets sin organizar
2. **🏢 Gastos de oficina** (azul) - Material y equipamiento  
3. **🍽️ Comidas y restaurantes** (verde) - Gastos alimentarios
4. **🚗 Transporte** (naranja) - Gasolina, peajes, taxis
5. **💼 Servicios profesionales** (morado) - Asesorías, consultorías

## 🔧 Características Técnicas

### Drag & Drop Implementation
```typescript
// Estado del ticket siendo arrastrado
const [draggedTicket, setDraggedTicket] = useState<string | null>(null);

// Handlers para eventos de arrastre
handleDragStart(e, ticketId) // Iniciar arrastre
handleDragOver(e) // Permitir drop
handleDrop(e, targetFolderId) // Procesar drop
```

### TreeView Preline Structure
```html
<div class="hs-accordion-treeview-root">
  <div class="hs-accordion-group">
    <div class="hs-accordion">
      <div class="hs-accordion-heading">
        <button class="hs-accordion-toggle">...</button>
        <div class="hs-accordion-selectable">...</div>
      </div>
      <div class="hs-accordion-content">
        <!-- Líneas conectoras automáticas -->
        <div class="ps-7 relative before:absolute before:bg-gray-100">
          <!-- Carpetas hijas aquí -->
        </div>
      </div>
    </div>
  </div>
</div>
```

### Iconos SVG Paths
```typescript
const ICON_MAP = {
  folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9...',
  briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16...',
  // ... más iconos
}
```

## 🛠️ Instalación y Configuración

### 1. Aplicar migraciones
```bash
supabase db push
```

### 2. Verificar funcionalidad
1. Ir a `/dashboard/organizar-tickets`
2. Crear carpetas nuevas
3. Arrastrar tickets desde el panel derecho
4. Verificar contadores y estado

### 3. Limpiar duplicados (si necesario)
La migración `20250120000005_clean_duplicate_folders.sql` limpia automáticamente carpetas duplicadas.

## 🎨 Personalización

### Añadir nuevos iconos
1. Obtener SVG path del icono
2. Añadir a `ICON_MAP` en `organizar-tickets/page.tsx`
3. Añadir opción en select del modal

### Añadir nuevos colores
1. Definir clases de color en componente
2. Añadir opción en select del modal
3. Actualizar lógica de aplicación de colores 