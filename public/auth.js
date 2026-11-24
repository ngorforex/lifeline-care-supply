const form=document.querySelector("[data-auth-form]");
if(form){
 const message=document.querySelector(".message");
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(form).entries());
  const mode=form.dataset.authForm;
  if(mode==="register"&&values.password!==values.confirmPassword){
   message.className="message";message.textContent="The passwords do not match.";return;
  }
  const button=form.querySelector("button[type=submit]");
  message.textContent="";message.className="message";button.disabled=true;button.textContent="Please wait…";
  const payload=mode==="register"?{phone:values.phone,password:values.password}:{phone:values.phone,password:values.password};
  try{
   const response=await fetch("/api/auth/"+mode,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Unable to continue. Try again.");
   message.className="message success";message.textContent=mode==="register"?"Account created. Opening your investor workspace…":"Signed in. Opening your investor workspace…";
   location.assign("/investor/");
  }catch(error){message.textContent=error.message;button.disabled=false;button.textContent=mode==="register"?"Create investor account →":"Sign in to your account →";}
 });
}

document.querySelectorAll("[data-password-toggle]").forEach(toggle=>{
 toggle.addEventListener("click",()=>{
  const field=document.getElementById("password");
  if(!field)return;
  const reveal=field.type==="password";
  field.type=reveal?"text":"password";
  toggle.textContent=reveal?"Hide":"Show";
  toggle.setAttribute("aria-label",reveal?"Hide password":"Show password");
 });
});
