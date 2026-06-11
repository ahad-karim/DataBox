import { extractProductsFromWebsite } from '../src/services/groq';

async function run() {
  const url = "https://www.scrapingcourse.com/ecommerce/";
  console.log("Fetching from jina...");
  const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'X-Return-Format': 'markdown' }
  });
  if (!jinaResponse.ok) {
    console.error("Jina failed", jinaResponse.status, await jinaResponse.text());
    return;
  }
  const markdown = await jinaResponse.text();
  console.log(`Jina success, length: ${markdown.length}`);
  
  console.log("Calling Groq...");
  const products = await extractProductsFromWebsite(markdown);
  console.log(`Extracted products:`, products);
}
run();
