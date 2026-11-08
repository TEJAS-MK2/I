export type KhataProposal = { kind:"credit_sale"; customerName:string; amount:string; currency:"INR"; items:Array<{name:string;quantity:string;unit:string}>; sourceText:string; requiresReview:true };
const amountPattern=/(?:₹\s*|rs\.?\s*|inr\s*)?(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|taka|টাকা)?/i;
const itemPattern=/(\d+(?:\.\d+)?)\s*(kg|কেজি|কিলো|g|গ্রাম|pcs?|pieces?|পিস)\s+([\p{L}][\p{L}\s-]{0,30})/iu;
/** Conservative preview parser. It never writes a transaction. */
export function parseKhataUtterance(input:string):KhataProposal|null {
 const sourceText=input.trim();
 if(!sourceText||!/(udhar|উধার|বাকি|credit|due)/i.test(sourceText))return null;
 const amountMatch=sourceText.match(amountPattern); if(!amountMatch)return null;
 const beforeAmount=sourceText.slice(0,amountMatch.index).replace(/[,،]/g," ").trim();
 const customerName=beforeAmount.split(/\s+/).filter(Boolean).slice(-2).join(" ");
 if(!customerName)return null;
 const itemMatch=sourceText.match(itemPattern);
 return {kind:"credit_sale",customerName,amount:Number(amountMatch[1]).toFixed(2),currency:"INR",items:itemMatch?[{quantity:itemMatch[1],unit:itemMatch[2],name:itemMatch[3].trim()}]:[],sourceText,requiresReview:true};
}
