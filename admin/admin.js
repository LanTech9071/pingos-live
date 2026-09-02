import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://sodxkspfdpmixdujhhnh.supabase.co";
const SUPABASE_KEY = "sb_publishable_ev6Rh1JnnmkjNbHIbnV7aA_V9GVZzN1";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const workspace = document.querySelector("#workspace");
const pageTitle = document.querySelector("#page-title");
const dialog = document.querySelector("#editor-dialog");
const editorForm = document.querySelector("#editor-form");
const editorFields = document.querySelector("#editor-fields");
const dialogTitle = document.querySelector("#dialog-title");
const editorMessage = document.querySelector("#editor-message");
let currentUser = null;
let currentProfile = null;
let saveHandler = null;

const titles = { dashboard:"Visão geral", site:"Conteúdo do site", plans:"Planos e preços", clients:"Clientes", contracts:"Contratos", team:"Equipe e acessos", history:"Histórico de alterações" };
const esc = (value="") => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
const money = value => value == null || value === "" ? "—" : Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date = value => value ? new Date(value).toLocaleDateString("pt-BR") : "—";

function setMessage(el, text, ok=false){ el.textContent=text || ""; el.style.color=ok?"#76dda0":"#ff8c96"; }
function field(name,label,value="",type="text",full=false,extra=""){
  if(type==="checkbox") return `<label class="checkbox ${full?"full":""}"><input name="${name}" type="checkbox" ${value?"checked":""}> ${label}</label>`;
  if(type==="textarea") return `<label class="${full?"full":""}">${label}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
  return `<label class="${full?"full":""}">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function selectField(name,label,options,value="",full=false){
  return `<label class="${full?"full":""}">${label}<select name="${name}">${options.map(([v,l])=>`<option value="${v}" ${v===value?"selected":""}>${l}</option>`).join("")}</select></label>`;
}
function openEditor(title, fields, onSave){
  dialogTitle.textContent=title; editorFields.innerHTML=fields; editorMessage.textContent=""; saveHandler=onSave; dialog.showModal();
}
function closeEditor(){ dialog.close(); editorForm.reset(); saveHandler=null; }
document.querySelector("#close-dialog").onclick=closeEditor;
document.querySelector("#cancel-dialog").onclick=closeEditor;
editorForm.addEventListener("submit", async e => {
  e.preventDefault(); if(!saveHandler) return;
  const button=editorForm.querySelector('button[type="submit"]'); button.disabled=true; button.textContent="Salvando...";
  try { await saveHandler(new FormData(editorForm)); closeEditor(); await loadView(activeView()); }
  catch(error){ setMessage(editorMessage,error.message); }
  finally { button.disabled=false; button.textContent="Salvar alterações"; }
});

document.querySelector("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const message=document.querySelector("#login-message"); setMessage(message,"Entrando...",true);
  const { data,error }=await supabase.auth.signInWithPassword({email:document.querySelector("#login-email").value.trim(),password:document.querySelector("#login-password").value});
  if(error){setMessage(message,"E-mail ou senha inválidos.");return}
  await startSession(data.user);
});
document.querySelector("#logout-button").onclick=async()=>{await supabase.auth.signOut();location.reload()};
document.querySelector("#menu-button").onclick=()=>appView.classList.toggle("menu-open");
document.querySelector("#admin-nav").addEventListener("click",e=>{
  const button=e.target.closest("button[data-view]"); if(!button)return;
  document.querySelectorAll("#admin-nav button").forEach(b=>b.classList.remove("active"));button.classList.add("active");
  appView.classList.remove("menu-open");loadView(button.dataset.view);
});
function activeView(){return document.querySelector("#admin-nav button.active")?.dataset.view || "dashboard"}

async function startSession(user){
  const {data:profile,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
  if(error || !profile?.active || !["owner","admin","staff"].includes(profile.role)){
    await supabase.auth.signOut(); setMessage(document.querySelector("#login-message"),"Esta conta ainda não possui acesso ao painel."); return;
  }
  currentUser=user; currentProfile=profile; document.querySelector("#user-email").textContent=user.email;
  loginView.classList.add("hidden");appView.classList.remove("hidden");await loadView("dashboard");
}

async function loadView(view){
  pageTitle.textContent=titles[view];workspace.innerHTML='<div class="empty">Carregando...</div>';
  const loaders={dashboard:loadDashboard,site:loadSite,plans:loadPlans,clients:loadClients,contracts:loadContracts,team:loadTeam,history:loadHistory};
  try{await loaders[view]()}catch(error){workspace.innerHTML=`<div class="note">Não foi possível carregar: ${esc(error.message)}</div>`}
}

async function loadDashboard(){
  const [clients,contracts,plans,sections]=await Promise.all([
    supabase.from("clients").select("*",{count:"exact",head:true}),
    supabase.from("contracts").select("*",{count:"exact",head:true}),
    supabase.from("plans").select("*",{count:"exact",head:true}),
    supabase.from("site_sections").select("*",{count:"exact",head:true})
  ]);
  const {data:recent}=await supabase.from("clients").select("*").order("created_at",{ascending:false}).limit(5);
  workspace.innerHTML=`<div class="stats">
    <div class="stat"><small>Clientes</small><strong>${clients.count||0}</strong></div>
    <div class="stat"><small>Contratos</small><strong>${contracts.count||0}</strong></div>
    <div class="stat"><small>Planos</small><strong>${plans.count||0}</strong></div>
    <div class="stat"><small>Seções extras</small><strong>${sections.count||0}</strong></div>
  </div><div class="grid-2"><div class="card"><div class="section-head"><h3>Clientes recentes</h3></div>${recent?.length?recent.map(c=>`<p><b>${esc(c.company_name)}</b><br><small class="muted">${esc(c.contact_name||c.email||"Sem contato")}</small></p>`).join(""):'<p class="muted">Nenhum cliente cadastrado.</p>'}</div>
  <div class="card"><div class="section-head"><h3>Acesso</h3></div><p><span class="badge owner">${esc(currentProfile.role)}</span></p><p class="muted">Você está conectado como ${esc(currentUser.email)} e possui acesso ao conteúdo administrativo.</p></div></div>`;
}

async function loadSite(){
  const [{data:settings},{data:sections}]=await Promise.all([
    supabase.from("site_settings").select("*").order("key"),
    supabase.from("site_sections").select("*").order("sort_order")
  ]);
  const settingCards=(settings||[]).map(s=>`<article class="item-card"><span class="kick">${esc(s.key)}</span><h4>${esc(s.value?.name||s.value?.display_phone||s.key)}</h4><p class="muted">${esc(s.value?.tagline||s.value?.whatsapp||"Configuração geral")}</p><div class="row-actions"><button class="action edit-setting" data-key="${esc(s.key)}">Editar</button></div></article>`).join("");
  const sectionRows=(sections||[]).map(s=>`<tr><td>${s.sort_order}</td><td><b>${esc(s.title)}</b><br><small class="muted">${esc(s.slug)}</small></td><td><span class="badge ${s.visible?"active":""}">${s.visible?"Visível":"Oculta"}</span></td><td><div class="row-actions"><button class="action edit-section" data-id="${s.id}">Editar</button><button class="danger delete-section" data-id="${s.id}">Excluir</button></div></td></tr>`).join("");
  workspace.innerHTML=`<div class="section-head"><div><h3>Configurações principais</h3><p class="muted">Marca, contato e informações globais.</p></div></div><div class="cards-list">${settingCards}</div>
  <div class="section-head" style="margin-top:35px"><div><h3>Seções personalizadas</h3><p class="muted">Crie novos blocos que aparecerão no site público.</p></div><button id="new-section" class="primary">+ Nova seção</button></div><div class="table-wrap"><table><thead><tr><th>Ordem</th><th>Seção</th><th>Status</th><th>Ações</th></tr></thead><tbody>${sectionRows||'<tr><td colspan="4" class="empty">Nenhuma seção extra.</td></tr>'}</tbody></table></div>`;
  document.querySelectorAll(".edit-setting").forEach(b=>b.onclick=()=>editSetting(settings.find(s=>s.key===b.dataset.key)));
  document.querySelector("#new-section").onclick=()=>editSection();
  document.querySelectorAll(".edit-section").forEach(b=>b.onclick=()=>editSection(sections.find(s=>s.id===b.dataset.id)));
  document.querySelectorAll(".delete-section").forEach(b=>b.onclick=()=>removeRecord("site_sections",b.dataset.id,"Excluir esta seção?"));
}
function editSetting(setting){
  const value=setting.value||{}; const isContact=setting.key==="contact";
  openEditor("Editar "+setting.key,
    isContact?field("display_phone","Telefone exibido",value.display_phone)+field("whatsapp","WhatsApp com DDI",value.whatsapp):
    field("name","Nome da marca",value.name)+field("tagline","Frase da marca",value.tagline,"textarea",true),
    async f=>{const next=isContact?{display_phone:f.get("display_phone"),whatsapp:f.get("whatsapp")}:{name:f.get("name"),tagline:f.get("tagline")};const{error}=await supabase.from("site_settings").update({value:next,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq("key",setting.key);if(error)throw error}
  );
}
function editSection(section={}){
  openEditor(section.id?"Editar seção":"Nova seção",
    field("title","Título",section.title,"text",false,"required")+field("slug","Identificador",section.slug,"text",false,"required")+
    field("subtitle","Subtítulo",section.subtitle)+field("sort_order","Ordem",section.sort_order??0,"number")+
    field("body","Conteúdo",section.content?.body||"","textarea",true)+field("image_url","URL da imagem",section.image_url,"url",true)+field("visible","Exibir no site",section.visible??true,"checkbox",true),
    async f=>{const payload={title:f.get("title"),slug:f.get("slug").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-"),subtitle:f.get("subtitle"),sort_order:Number(f.get("sort_order")||0),content:{body:f.get("body")},image_url:f.get("image_url")||null,visible:f.get("visible")==="on",updated_by:currentUser.id};let q;if(section.id)q=supabase.from("site_sections").update(payload).eq("id",section.id);else q=supabase.from("site_sections").insert({...payload,created_by:currentUser.id});const{error}=await q;if(error)throw error}
  );
}

async function loadPlans(){
  const {data:plans,error}=await supabase.from("plans").select("*").order("sort_order");if(error)throw error;
  workspace.innerHTML=`<div class="section-head"><div><h3>Planos comerciais</h3><p class="muted">Edite preços, benefícios e destaque.</p></div><button id="new-plan" class="primary">+ Novo plano</button></div><div class="cards-list">${plans.map(p=>`<article class="item-card ${p.featured?"featured":""}"><span class="kick">${esc(p.label||"Plano")}</span><h4>${esc(p.name)}</h4><strong>${esc(p.price_label||money(p.price))}</strong><p>${esc(p.description||"")}</p><ul>${(p.features||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="row-actions"><button class="action edit-plan" data-id="${p.id}">Editar</button><button class="danger delete-plan" data-id="${p.id}">Excluir</button></div></article>`).join("")}</div>`;
  document.querySelector("#new-plan").onclick=()=>editPlan();document.querySelectorAll(".edit-plan").forEach(b=>b.onclick=()=>editPlan(plans.find(p=>p.id===b.dataset.id)));document.querySelectorAll(".delete-plan").forEach(b=>b.onclick=()=>removeRecord("plans",b.dataset.id,"Excluir este plano?"));
}
function editPlan(plan={}){
  openEditor(plan.id?"Editar plano":"Novo plano",
    field("name","Nome",plan.name,"text",false,"required")+field("label","Etiqueta",plan.label)+field("price","Preço",plan.price??"","number",false,'step="0.01"')+field("price_label","Texto do preço",plan.price_label)+field("description","Descrição",plan.description,"textarea",true)+field("features","Benefícios — um por linha",(plan.features||[]).join("\n"),"textarea",true)+field("sort_order","Ordem",plan.sort_order??0,"number")+field("featured","Plano destacado",plan.featured??false,"checkbox")+field("visible","Exibir no site",plan.visible??true,"checkbox",true),
    async f=>{const payload={name:f.get("name"),label:f.get("label"),price:f.get("price")||null,price_label:f.get("price_label"),description:f.get("description"),features:f.get("features").split("\n").map(x=>x.trim()).filter(Boolean),sort_order:Number(f.get("sort_order")||0),featured:f.get("featured")==="on",visible:f.get("visible")==="on",updated_by:currentUser.id};let q=plan.id?supabase.from("plans").update(payload).eq("id",plan.id):supabase.from("plans").insert({...payload,created_by:currentUser.id});const{error}=await q;if(error)throw error}
  );
}

async function loadClients(){
  const {data:clients,error}=await supabase.from("clients").select("*").order("company_name");if(error)throw error;
  workspace.innerHTML=`<div class="section-head"><div><h3>Clientes</h3><p class="muted">Cadastre empresas, responsáveis e informações comerciais.</p></div><button id="new-client" class="primary">+ Novo cliente</button></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Contato</th><th>Segmento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${clients.map(c=>`<tr><td><b>${esc(c.company_name)}</b><br><small class="muted">${esc(c.document_number||"")}</small></td><td>${esc(c.contact_name||"—")}<br><small class="muted">${esc(c.phone||c.email||"")}</small></td><td>${esc(c.segment||"—")}</td><td><span class="badge ${c.status}">${esc(c.status)}</span></td><td><div class="row-actions"><button class="action edit-client" data-id="${c.id}">Editar</button><button class="danger delete-client" data-id="${c.id}">Excluir</button></div></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Nenhum cliente.</td></tr>'}</tbody></table></div>`;
  document.querySelector("#new-client").onclick=()=>editClient();document.querySelectorAll(".edit-client").forEach(b=>b.onclick=()=>editClient(clients.find(c=>c.id===b.dataset.id)));document.querySelectorAll(".delete-client").forEach(b=>b.onclick=()=>removeRecord("clients",b.dataset.id,"Excluir este cliente e seus contratos?"));
}
function editClient(client={}){
  openEditor(client.id?"Editar cliente":"Novo cliente",
    field("company_name","Empresa",client.company_name,"text",false,"required")+field("contact_name","Responsável",client.contact_name)+field("email","E-mail",client.email,"email")+field("phone","Telefone",client.phone)+field("document_number","CPF/CNPJ",client.document_number)+field("segment","Segmento",client.segment)+selectField("status","Status",[["lead","Lead"],["active","Ativo"],["inactive","Inativo"]],client.status||"lead")+field("address","Endereço",client.address,"textarea",true)+field("notes","Observações",client.notes,"textarea",true),
    async f=>{const payload=Object.fromEntries([...f.entries()]);payload.updated_by=currentUser.id;let q=client.id?supabase.from("clients").update(payload).eq("id",client.id):supabase.from("clients").insert({...payload,created_by:currentUser.id});const{error}=await q;if(error)throw error}
  );
}

async function loadContracts(){
  const [{data:contracts,error},{data:clients}]=await Promise.all([supabase.from("contracts").select("*,clients(company_name)").order("created_at",{ascending:false}),supabase.from("clients").select("id,company_name").order("company_name")]);if(error)throw error;
  workspace.innerHTML=`<div class="section-head"><div><h3>Contratos</h3><p class="muted">Controle valores, vigência, status e documentos.</p></div><button id="new-contract" class="primary" ${clients?.length?"":"disabled"}>+ Novo contrato</button></div>${clients?.length?"":'<div class="note">Cadastre pelo menos um cliente antes de criar um contrato.</div>'}<div class="table-wrap"><table><thead><tr><th>Contrato</th><th>Cliente</th><th>Vigência</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>${contracts.map(c=>`<tr><td><b>${esc(c.title)}</b></td><td>${esc(c.clients?.company_name||"—")}</td><td>${date(c.start_date)} — ${date(c.end_date)}</td><td>${money(c.amount)}</td><td><span class="badge ${c.status}">${esc(c.status)}</span></td><td><div class="row-actions"><button class="action edit-contract" data-id="${c.id}">Editar</button>${c.file_path?`<button class="action file-contract" data-path="${esc(c.file_path)}">Arquivo</button>`:""}<button class="danger delete-contract" data-id="${c.id}">Excluir</button></div></td></tr>`).join("")||'<tr><td colspan="6" class="empty">Nenhum contrato.</td></tr>'}</tbody></table></div>`;
  if(clients?.length)document.querySelector("#new-contract").onclick=()=>editContract({},clients);document.querySelectorAll(".edit-contract").forEach(b=>b.onclick=()=>editContract(contracts.find(c=>c.id===b.dataset.id),clients));document.querySelectorAll(".delete-contract").forEach(b=>b.onclick=()=>removeRecord("contracts",b.dataset.id,"Excluir este contrato?"));document.querySelectorAll(".file-contract").forEach(b=>b.onclick=()=>openContractFile(b.dataset.path));
}
function editContract(contract={},clients=[]){
  const clientOptions=clients.map(c=>[c.id,c.company_name]);
  openEditor(contract.id?"Editar contrato":"Novo contrato",
    selectField("client_id","Cliente",clientOptions,contract.client_id)+field("title","Título",contract.title,"text",false,"required")+field("amount","Valor",contract.amount??"","number",false,'step="0.01"')+selectField("status","Status",[["draft","Rascunho"],["pending_signature","Aguardando assinatura"],["active","Ativo"],["completed","Concluído"],["cancelled","Cancelado"]],contract.status||"draft")+field("start_date","Início",contract.start_date,"date")+field("end_date","Término",contract.end_date,"date")+field("description","Descrição",contract.description,"textarea",true)+field("file","Documento PDF","", "file",true,'accept=".pdf,image/*"'),
    async f=>{let filePath=contract.file_path||null;const file=f.get("file");if(file?.size){filePath=`${contract.client_id||f.get("client_id")}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const{error:uploadError}=await supabase.storage.from("contracts").upload(filePath,file);if(uploadError)throw uploadError}const payload={client_id:f.get("client_id"),title:f.get("title"),amount:f.get("amount")||null,status:f.get("status"),start_date:f.get("start_date")||null,end_date:f.get("end_date")||null,description:f.get("description"),file_path:filePath,updated_by:currentUser.id};let q=contract.id?supabase.from("contracts").update(payload).eq("id",contract.id):supabase.from("contracts").insert({...payload,created_by:currentUser.id});const{error}=await q;if(error)throw error}
  );
}
async function openContractFile(path){const{data,error}=await supabase.storage.from("contracts").createSignedUrl(path,120);if(error)return alert(error.message);window.open(data.signedUrl,"_blank")}

async function loadTeam(){
  const {data:profiles,error}=await supabase.from("profiles").select("*").order("created_at");if(error)throw error;
  workspace.innerHTML=`<div class="section-head"><div><h3>Equipe e acessos</h3><p class="muted">Controle nível de acesso e bloqueio das contas.</p></div></div><div class="note">Novos usuários devem ser criados em Authentication → Users no Supabase. Depois, eles aparecerão aqui automaticamente.</div><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead><tbody>${profiles.map(p=>`<tr><td>${esc(p.full_name||p.id)}</td><td><span class="badge ${p.role}">${esc(p.role)}</span></td><td>${p.active?"Ativo":"Bloqueado"}</td><td><button class="action edit-profile" data-id="${p.id}">Editar acesso</button></td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll(".edit-profile").forEach(b=>b.onclick=()=>editProfile(profiles.find(p=>p.id===b.dataset.id)));
}
function editProfile(profile){openEditor("Editar acesso",field("full_name","Nome",profile.full_name)+selectField("role","Função",[["owner","Proprietário"],["admin","Administrador"],["staff","Funcionário"],["pending","Pendente"]],profile.role)+field("active","Conta ativa",profile.active,"checkbox",true),async f=>{const{error}=await supabase.from("profiles").update({full_name:f.get("full_name"),role:f.get("role"),active:f.get("active")==="on"}).eq("id",profile.id);if(error)throw error})}

async function loadHistory(){
  const {data:logs,error}=await supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(100);if(error)throw error;
  workspace.innerHTML=`<div class="section-head"><div><h3>Histórico</h3><p class="muted">Últimas 100 alterações administrativas.</p></div></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Tabela</th><th>Ação</th><th>Registro</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${new Date(l.created_at).toLocaleString("pt-BR")}</td><td>${esc(l.table_name)}</td><td><span class="badge">${esc(l.action)}</span></td><td><small>${esc(l.record_id||"—")}</small></td></tr>`).join("")||'<tr><td colspan="4" class="empty">Nenhuma alteração registrada.</td></tr>'}</tbody></table></div>`;
}

async function removeRecord(table,id,message){if(!confirm(message))return;const{error}=await supabase.from(table).delete().eq("id",id);if(error)alert(error.message);else await loadView(activeView())}

const {data:{session}}=await supabase.auth.getSession();
if(session?.user)await startSession(session.user);
