export type Permission = 'read' | 'edit';

export interface ShoppingList {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  color: string;
}

export interface ListItem {
  id: string;
  name: string;
  isBought: boolean;
  quantity: string;
  createdAt: number;
}

export interface ShareLink {
  id: string;
  listId: string;
  permission: Permission;
  isActive: boolean;
  createdAt: number;
}

export interface UserSuggestion {
  name: string;
  count: number;
}
