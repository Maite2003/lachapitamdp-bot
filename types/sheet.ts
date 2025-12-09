export type GoogleSheetRow = string[];

export interface Product {
  category: string,
  subcategory: string,
  name: string,
  price: Record<string, number>,
  description: string,
  last_synced_at: string
}