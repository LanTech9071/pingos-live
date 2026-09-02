import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabase=createClient("https://sodxkspfdpmixdujhhnh.supabase.co","sb_publishable_ev6Rh1JnnmkjNbHIbnV7aA_V9GVZzN1");
const esc=(v="")=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=v=>v==null||v===""?"":Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

async function syncPublicSite(){
  const [{data:settings},{data:plans},{data:sections}]=await Promise.all([
    supabase.from("site_settings").select("*"),
    supabase.from("plans").select("*").eq("visible",true).order("sort_order"),
    supabase.from("site_sections").select("*").eq("visible",true).order("sort_order")
  ]);
  const map=Object.fromEntries((settings||[]).map(s=>[s.key,s.value]));
  const contact=map.contact||{};
  if(contact.whatsapp){
    document.querySelectorAll('a[href*="wa.me"]').forEach(a=>{
      const message=a.href.includes("?text=")?a.href.split("?text=")[1]:"";
      a.href=`https://wa.me/${contact.whatsapp}${message?`?text=${message}`:""}`;
    });
  }
  if(contact.display_phone){
    document.querySelectorAll(".phone").forEach(el=>el.textContent=contact.display_phone);
  }
  if(plans?.length){
    const grid=document.querySelector(".plans");
    if(grid) grid.innerHTML=plans.map(p=>`<article class="plan ${p.featured?"hot":""}"><span class="kick">${esc(p.label||"Plano")}</span><h3>${esc(p.name)}</h3>${p.price||p.price_label?`<strong>${esc(p.price_label||money(p.price))}</strong>`:""}<p>${esc(p.description||"")}</p><ul>${(p.features||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><a class="btn" href="#contato">Solicitar proposta</a></article>`).join("");
  }
  if(sections?.length){
    const plansSection=document.querySelector("#planos");
    sections.forEach((s,index)=>{
      const section=document.createElement("section");section.className=`section ${index%2?"dark":""}`;
      section.id=s.slug;
      section.innerHTML=`<div class="heading"><div><span class="kick">${esc(s.subtitle||"PINGOS LIVE")}</span><h2>${esc(s.title)}</h2></div><p>${esc(s.content?.body||"")}</p></div>${s.image_url?`<img src="${esc(s.image_url)}" alt="${esc(s.title)}" style="width:100%;max-height:520px;object-fit:cover;border-radius:24px">`:""}`;
      plansSection?.before(section);
    });
  }
}
syncPublicSite().catch(()=>{});
