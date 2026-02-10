import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { formatDate } from "../utils/date";
const url = 'http://localhost:8000/api/auth'
import toast from "react-hot-toast";

const DashboardPage = () => {
	const { user, data, logout, error } = useAuthStore();

	const handleLogout = async() => {
		const response = await fetch(`${url}/signout`, {
            method: "POST",
            mode: "cors",
            headers:{
                "content-Type": "application/json",
                "authorization": `Bearer ${data.token}`,
                "client": "not-browser"
            },
          });
          const res = await response.json();
			if (res.success) {
				toast.success("Logged out successfully");
			} else {
				toast.error(res.message || "Error logging out");
			}
			setTimeout(() => {
				logout(res);
			}, 1000);
		  console.log(res)
	};


	const handleuploadchange = async(e)=>{
       const file = e.target.files[0];
	   if(!file){
		   toast.error("Please select a file");
		   return;

	   }
	   const data = new FormData();	
	   data.append("file", file);
	   data.append("upload-preset","finesse");
	   data.append("cloud_name","db4x6r4zm");
	 const res = await fetch("https://api.cloudinary.com/v1_1/db4x6r4zm/image/upload", {
		   method: "POST",
		   body: data
	   })
	    const uploaaded = await res.json();
		if (uploaaded.url) {
			console.log(data);
		   toast.success("Profile picture uploaded successfully");
		}else{
            console.log(err);
		   toast.error("Error uploading profile picture");
		}

	   
	}
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.9 }}
			transition={{ duration: 0.5 }}
			className='max-w-md w-full mx-auto mt-10 p-8 bg-gray-900 bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl border border-gray-800'
		>
			<h2 className='text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text'>
				Dashboard
			</h2>
			<img src='' alt="profile" />
           {/* upload profile pic */}
          <input 
		   type="file" 
		   onChange={(e)=>handleuploadchange(e)}
		  />




			<div className='space-y-6'>
				<motion.div
					className='p-4 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700'
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					<h3 className='text-xl font-semibold text-green-400 mb-3'>Profile Information</h3>
					<p className='text-gray-300'>Name: {user.name}</p>
					<p className='text-gray-300'>Email: {user.email}</p>
				</motion.div>
				<motion.div
					className='p-4 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700'
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					<h3 className='text-xl font-semibold text-green-400 mb-3'>Account Activity</h3>
					<p className='text-gray-300'>
						<span className='font-bold'>Joined: </span>
						{new Date(user.createdAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</p>
					<p className='text-gray-300'>
						<span className='font-bold'>Last Login: </span>

						{formatDate(user.lastLogin)}
					</p>
				</motion.div>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.6 }}
				className='mt-4'
			>
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleLogout}
					className='w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white 
				font-bold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700
				 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900'
				>
					Logout
				</motion.button>
			</motion.div>
		</motion.div>
	);
};
export default DashboardPage;
