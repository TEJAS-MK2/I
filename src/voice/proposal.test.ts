import {describe,expect,it} from "vitest";
import {parseKhataUtterance} from "./proposal";
describe("voice proposal parser",()=>{
 it("extracts a review-only proposal from mixed-language shop speech",()=>{
  expect(parseKhataUtterance("Ramesh 150 taka udhar, 2 kg sugar")).toMatchObject({kind:"credit_sale",customerName:"Ramesh",amount:"150.00",currency:null,items:[{quantity:"2",unit:"kg",name:"sugar"}],requiresReview:true});
 });
 it("rejects a note without an explicit credit cue",()=>expect(parseKhataUtterance("Ramesh 150 rupees")).toBeNull());
 it("rejects a note without a recognizable amount",()=>expect(parseKhataUtterance("Ramesh udhar sugar")).toBeNull());
});
