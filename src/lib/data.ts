export type ParentDashboardItem = {
  id: string;
  task: string;
  completed: number;
  assigned: number;
};

export type ChildChecklistItem = {
  id: string;
  task: string;
  done: boolean;
};

const parentDashboardItems: ParentDashboardItem[] = [
  { id: "tidy-room", task: "Tidy room", completed: 1, assigned: 2 },
  { id: "set-table", task: "Set table", completed: 2, assigned: 2 },
  { id: "water-plants", task: "Water plants", completed: 0, assigned: 2 },
];

const childChecklistItems: ChildChecklistItem[] = [
  { id: "tidy-room", task: "Tidy room", done: false },
  { id: "set-table", task: "Set table", done: true },
  { id: "water-plants", task: "Water plants", done: false },
];

export const allowanceStore = {
  getParentDashboard() {
    return parentDashboardItems;
  },
  getChildChecklist() {
    return childChecklistItems;
  },
};
