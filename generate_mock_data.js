import fs from 'fs';
import path from 'path';

const products = [
  { name: 'Aarong Milk 1L', category: 'Dairy', cost: 75, price: 90 },
  { name: 'Pran Mango Juice 250ml', category: 'Beverages', cost: 20, price: 30 },
  { name: 'RFL Plastic Chair', category: 'Furniture', cost: 400, price: 650 },
  { name: 'Radhuni Chilli Powder 200g', category: 'Grocery', cost: 50, price: 80 },
  { name: 'Ispahani Mirzapore Tea 500g', category: 'Food', cost: 180, price: 250 },
  { name: 'Fresh Soybean Oil 5L', category: 'Grocery', cost: 700, price: 800 },
  { name: 'Walton Blender', category: 'Electronics', cost: 2000, price: 3000 },
  { name: 'Square Toiletries', category: 'Personal Care', cost: 60, price: 100 },
  { name: 'Beximco Paracetamol', category: 'Medicine', cost: 10, price: 20 },
  { name: 'Bata Formal Shoes', category: 'Footwear', cost: 1200, price: 2500 }
];

const locations = ['Dhaka', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Mymensingh', 'Rangpur', 'Comilla', 'Gazipur'];
const channels = ['Retail', 'Wholesale', 'Direct', 'Online'];
const segments = ['Consumer', 'Corporate', 'Retailer', 'Household'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateData(fileIndex, numRows) {
  // generate dates over the past year
  const rows = [];
  rows.push('Date,Product_Name,Category,Location,Sales_Channel,Units_Sold,Revenue_BDT,Cost_Price,Current_Stock,Customer_Segment');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);

  for (let i = 0; i < numRows; i++) {
    const d = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    const dateStr = d.toISOString().split('T')[0];

    const prod = getRandomItem(products);
    const loc = getRandomItem(locations);
    const channel = getRandomItem(channels);
    const segment = getRandomItem(segments);

    const units = getRandomInt(1, 100);
    const revenue = units * prod.price;
    const totalCost = units * prod.cost;
    const stock = getRandomInt(10, 500);

    rows.push(`${dateStr},${prod.name},${prod.category},${loc},${channel},${units},${revenue},${totalCost},${stock},${segment}`);
  }

  // Sort rows by date (excluding header)
  const header = rows.shift();
  rows.sort((a, b) => new Date(a.split(',')[0]) - new Date(b.split(',')[0]));
  rows.unshift(header);

  return rows.join('\n');
}

for (let i = 1; i <= 5; i++) {
  const content = generateData(i, 500);
  const filePath = path.join(process.cwd(), `mock_sales_data_part${i}.csv`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Generated ${filePath}`);
}
