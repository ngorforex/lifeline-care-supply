const referralInput=document.querySelector('input[name="referralCode"]');
if(referralInput){
 const referralFromUrl=new URLSearchParams(location.search).get("ref");
 if(referralFromUrl&&!referralInput.value)referralInput.value=referralFromUrl.trim().toUpperCase();
}
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
  const payload=mode==="register"?{firstName:values.firstName,middleName:values.middleName||null,lastName:values.lastName,phone:values.phone,password:values.password,referralCode:values.referralCode||""}:{phone:values.phone,password:values.password};
  try{
   const response=await fetch("/api/auth/"+mode,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
   const responseText=await response.text();
   let result={};
   try { result=JSON.parse(responseText); }
   catch {
    console.error("Authentication endpoint returned non-JSON content:",response.status,responseText.slice(0,300));
    throw new Error("The account service returned an invalid response. Please refresh and try again. If this continues, contact support.");
   }
   if(!response.ok)throw new Error(result.error||"Unable to continue. Try again.");
   message.className="message success";message.textContent=mode==="register"?"Account created. Opening your investor workspace…":"Signed in. Opening your investor workspace…";
   location.assign("/investor/");
  }catch(error){message.textContent=error.message;button.disabled=false;button.textContent=mode==="register"?"Create investor account →":"Sign in to your account →";}
 });
}

document.querySelectorAll("[data-password-toggle]").forEach(toggle=>{
 toggle.addEventListener("click",()=>{
  const field=document.getElementById(toggle.dataset.target||"password");
  if(!field)return;
  const reveal=field.type==="password";
  field.type=reveal?"text":"password";
  toggle.innerHTML=reveal?"<svg class=\"field-icon toggle-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m3 3 18 18M10.6 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.8M6.2 6.3C3.5 8.1 2 12 2 12s3.6 7 10 7c1.3 0 2.5-.3 3.5-.8\"/><path d=\"M9.9 9.9a3 3 0 0 0 4.2 4.2\"/></svg>":"<svg class=\"field-icon toggle-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>";
  toggle.setAttribute("aria-label",reveal?"Hide password":"Show password");
 });
});
