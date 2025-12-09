
export type GoogleSheetRow = [
  string, // name
  string, // price
  string?  // stock
];

export interface Product {
  name: string,
  price: number,
  stock: string,
  last_synced_at: string
}