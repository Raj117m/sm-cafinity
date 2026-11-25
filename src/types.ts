export type Status='CANCELLATION_PENDING'|'NEW'|'PREPARING'|'READY'|'SERVED'|'CANCELLED';
export type Option={id:string;name:string;price:number;group:string};
export type Product={
  id:number;
  category_id:number;
  name:string;
  description:string;
  price:number;
  compare_at_price:number|null;
  image:string;
  pairing_product_id:number|null;
  pairing_reason:string;
  available:number;
  orderable:boolean;
  ingredients:number[];
  options:Option[];
  priority?:number;
  surplus_boost?:boolean;
};
export type Item={id:number;product_id:number;name:string;quantity:number;unit_price:number;options:string};
export type Order={
  id:number;
  bill_id:number;
  table_id:number|null;
  customer_id?:number;
  status:Status;
  preparing_at?:number|null;
  ready_at?:number|null;
  served_at?:number|null;
  total:number;
  notes:string;
  deadline:number;
  created_at:number;
  items:Item[];
  canCancel?:boolean;
  queueAhead?:number;
};
export type Payment={id:number;amount:number;method:string;created_at:number;voided_at:number|null;void_reason:string|null};
export type Bill={id:number;table_id:number|null;status:'OPEN'|'PAID'|'CLOSED';gross:number;discount:number;total:number;paid:number;outstanding:number;orders:Order[];payments:Payment[]};
export type Game={id:number;name:string;description:string;image:string;available:number;quantity_total:number;available_count:number;in_use:number};
export type GameRequest={id:number;game_id:number;name:string;table_id:number;status:'REQUESTED'|'DELIVERED'|'RETURNED';created_at:number};
export type Staff={id:number;name:string;username:string;role:'owner'|'staff';active:number};
export type Settings={
  cafeName:string;
  tableCount:number;
  cancellationSeconds:number;
  earnCoins:number;
  earnPer:number;
  coinValue:number;
  maxDiscountPercent:number;
  suggestionCoins:number;
  cooldownDays:number;
  smartInventory?:boolean;
};

export type StaffShift={
  staff_id:number;
  staff_name?:string;
  username?:string;
  role?:string;
  shift_start:string;
  shift_end:string;
  target_hours:number;
  break_minutes:number;
  break_buffer_minutes:number;
};

export type StaffPunch={
  id:number;
  staff_id:number;
  staff_name?:string;
  date:string;
  type:'CHECK_IN'|'START_BREAK'|'END_BREAK'|'CHECK_OUT';
  timestamp:number;
  notes?:string;
  source:string;
};

export type PunchType = StaffPunch['type'];

export type StaffAttendance={
  staff_id:number;
  status:'NOT_CHECKED_IN'|'WORKING'|'ON_BREAK'|'CHECKED_OUT';
  shift:StaffShift;
  punches:StaffPunch[];
  workedSeconds:number;
  breakSeconds:number;
  breakBufferRemainingSeconds:number;
};

export type RosterStaff={
  staff_id:number;
  name:string;
  username:string;
  role:string;
  shift:StaffShift;
  status:'NOT_CHECKED_IN'|'WORKING'|'ON_BREAK'|'CHECKED_OUT';
  workedSeconds:number;
  breakSeconds:number;
  lastPunch?:StaffPunch;
};

export type CafeEvent={
  id:number;
  title:string;
  description:string;
  event_date:string;
  start_time:string;
  end_time:string;
  event_type:'PRIVATE'|'OPEN';
  host_name:string;
  host_contact:string;
  table_id?:number|null;
  session_token?:string;
  customer_id?:number|null;
  status:'PENDING'|'APPROVED'|'DECLINED';
  max_participants:number;
  created_at:number;
  rsvp_count?:number;
  joined?:boolean;
};

export type Snapshot={
  demo:boolean;
  now:number;
  settings:Settings;
  tables:{id:number;token:string;active:number}[];
  categories:{id:number;name:string}[];
  ingredients:{id:number;name:string;available:number;stock_units?:number}[];
  products:Product[];
  games:Game[];
  orders:Order[];
  bills:Bill[];
  gameRequests:GameRequest[];
  suggestions:{normalized:string;name:string;count:number;people:number;reviewed:number;recent:number}[];
  customer:{id:number;name:string;balance:number}|null;
  demoCustomers:{id:number;name:string}[];
  loyalty:{id:number;coins:number;reason:string;created_at:number}[];
  staff:Staff|null;
  staffAccounts:Staff[];
  audit:{id:number;actor:string;action:string;entity:string;details:string;created_at:number}[];
  kitchenQueueCount:number;
  events:CafeEvent[];
  attendance:StaffAttendance|null;
  attendanceRoster:RosterStaff[];
  attendanceLogs:StaffPunch[];
  staffShifts:StaffShift[];
};

export type CartLine={productId:number;quantity:number;options:string[]};
export type Report={sales:number;paidOrders:number;average:number;products:{name:string;quantity:number}[];ingredients:{name:string;quantity:number}[];games:{name:string;quantity:number}[];refunds:{id:number;amount:number;void_reason:string}[]};
