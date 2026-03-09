import Dexie, { type Table } from 'dexie';
import { ShoppingList, ListItem, ShareLink } from '../types';

export class ShopShareDB extends Dexie {
  lists!: Table<ShoppingList>;
  items!: Table<ListItem & { listId: string }>;
  shares!: Table<ShareLink>;

  constructor() {
    super('ShopShareDB');
    this.version(1).stores({
      lists: 'id, ownerId, updatedAt',
      items: 'id, listId, createdAt',
      shares: 'id, listId'
    });
  }
}

export const localDB = new ShopShareDB();
