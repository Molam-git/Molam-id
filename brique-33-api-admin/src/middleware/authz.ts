// authzEnforce("id:superadmin") means: user must hold role superadmin@id
export function authzEnforce(required:string){
  return async (req:any, res:any, next:any) => {
    const user = req.user;
    if(!user) return res.status(401).json({ error: "unauthorized" });

    if(required === "id:superadmin"){
      const ok = user.roles?.some((r:any)=> r.module==='id' && r.role==='superadmin');
      if(!ok) return res.status(403).json({ error: "forbidden" });
      return next();
    }
    // ... other scopes
    return next();
  };
}
