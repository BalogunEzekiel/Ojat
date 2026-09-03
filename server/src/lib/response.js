export const ok=(res,data={},message='Success',status=200)=>res.status(status).json({success:true,message,data});
export const fail=(res,message='Request failed',status=400,errors)=>res.status(status).json({success:false,message,errors});
