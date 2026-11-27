function normalizeRecoveryPhone(value){
 const phone=String(value||"").trim().replace(/[\s()-]/g,"");
 if(/^07[0-9]{8}$/.test(phone))return "+256"+phone.slice(1);
 if(/^\+2567[0-9]{8}$/.test(phone))return phone;
 return "";
}
const requestForm=document.querySelector("[data-reset-request]");
const completeForm=document.querySelector("[data-reset-complete]");
const requestMessage=document.querySelector("[data-reset-request-message]");
const completeMessage=document.querySelector("[data-reset-complete-message]");
requestForm?.addEventListener("submit",async event=>{
 event.preventDefault();
 const submit=requestForm.querySelector('button[type="submit"]');
 const phone=normalizeRecoveryPhone(new FormData(requestForm).get("phone"));
 if(!phone){requestMessage.textContent="Enter a Ugandan mobile number as 07XXXXXXXX or +2567XXXXXXXX.";return;}
 requestMessage.textContent="";submit.disabled=true;submit.textContent="Sending…";
 try{
  const response=await fetch("/api/auth/password-reset/request",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({phone})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"A verification code could not be sent. Try again.");
  completeForm.elements.challengeToken.value=result.challengeToken||"";
  requestForm.hidden=true;completeForm.hidden=false;
  completeMessage.textContent=result.message||"If an active account matches that number, a code has been sent.";
  completeForm.querySelector('[name="code"]')?.focus();
 }catch(error){
  requestMessage.textContent=error.message||"A verification code could not be sent. Try again.";
 }finally{
  submit.disabled=false;submit.textContent="Send verification code";
 }
});
completeForm?.addEventListener("submit",async event=>{
 event.preventDefault();
 const values=Object.fromEntries(new FormData(completeForm).entries());
 const submit=completeForm.querySelector('button[type="submit"]');
 if(values.newPassword!==values.confirmPassword){completeMessage.textContent="The new passwords do not match.";return;}
 completeMessage.textContent="";submit.disabled=true;submit.textContent="Verifying…";
 try{
  const response=await fetch("/api/auth/password-reset/complete",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({challengeToken:values.challengeToken,code:values.code,newPassword:values.newPassword})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"Password could not be reset. Check the code and try again.");
  completeForm.reset();
  completeMessage.className="message success";
  completeMessage.textContent="Password reset successfully. Returning to sign in…";
  setTimeout(()=>location.replace("/login/?password_reset=1"),1200);
 }catch(error){
  completeMessage.textContent=error.message||"Password could not be reset. Try again.";
 }finally{
  submit.disabled=false;submit.textContent="Reset password";
 }
});
