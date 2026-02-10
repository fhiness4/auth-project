const jwt = require('jsonwebtoken');
const { signupschema, signinschema, acceptcodeschema, changePasswordSchema, acceptFPCodeSchema} = require('../middlewares/validator');
const user  = require('../models/usersmodel');
const {transport}  = require('../middlewares/sendmail');
const { dohash, dohashvalidation, hmacprocess } = require('../util/hashing');
const { exist } = require('joi');

const signup = async (req, res) => {
    const {name, email, password } = req.body;
    
    try {
        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const { error, value } = signupschema.validate({ email, password });
        if (error) {
            return res.status(400).json({   
                success: false,
                message: error.details[0].message
            });
        }

        // Check if user already exists
        const existinguser = await user.findOne({ email });
        if (existinguser) {
            return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'User already exists'
            });
        }

        // Hash password
        const hashpassword = await dohash(password, 12);

        // Create new user
        const newuser = new user({
            name,
            email,
            password: hashpassword
        });

        const result = await newuser.save();
        
        // Remove password from response
        result.password = undefined;
        
        res.status(201).json({
            success: true,
            message: `Account created successfully`,
            data: {
                email: result.email,
                id: result._id  // Include user ID in response
            },
            user: {
				...result._doc,
			},
        });

    } catch (error) {
        console.error('Signup error:', error);  // Better error logging
        
        // Handle specific MongoDB errors
        if (error.name === 'MongoError' || error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Database error occurred'
            });
        }
        
        // Generic server error
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

//sighin function
const signin = async(req, res) =>{
  const{email, password} = req.body
  try {
    const {error, value} = signinschema.validate({email, password});
    if (error) {
         return res.status(400).json({ 
                success: false,
                message: error.details[0].message
            });
    }

    const existinguser = await user.findOne({email}).select('+password');
    if (!existinguser) {
         return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'user do not exist'
            });
    }
   const result = await dohashvalidation(password, existinguser.password);
   if (!result) {
     return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'invalid credentials'
            });
   }

   const token  = jwt.sign({
    userId: existinguser._id,
    email: existinguser.email,
    verified: existinguser.verified
   },
   process.env.secret_token,{
    expiresIn:'8h'
   }
);

res.cookie('Authorization', 'Bearer' + token ,
     {expires: new Date(Date.now() + 8 * 3600000),
     httponly: process.env.NODE_ENV ==='production',
     secure: process.env.NODE_ENV ==='production' }).json({
        success: true,
        token,
        message:'logged in succesfully',
        user:{...existinguser._doc,
            password: undefined}
        
        
        
     })
  } catch (error) {
    console.log(error)
  }
}

// signout functionality
const signout = async (req, res) =>{
 res.clearCookie('Authorization').status(200).json({
    success: true,
    message: 'logged out successfully'
 })
};

// send code 
const sendverification =  async (req, res) =>{
    const {email} = req.body;
    try {
      // Check if user already exists
        const existinguser = await user.findOne({ email });
        if (!existinguser) {
            return res.status(401).json({  
                success: false,
                message: 'User not found'
            });
        }
         if (existinguser.verified) {
            return res.status(400).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'you are already verified'
            });
        };


        const codevalue =  Math.floor(Math.random() * 100000).toString();
        console.log(codevalue)
    let info = await transport.sendMail({
        from: process.env.node_code_sending_address,
        to: existinguser.email,
        subject: 'verification code',
        html: `<h1> Here's your verification code : ${codevalue} <h1/>`
    });

    if (info.accepted[0] === existinguser.email) {
        hashedcodevalue = hmacprocess(codevalue, process.env.hmac_verification_secret);
        existinguser.verificationcode = hashedcodevalue;
        existinguser.verificationcodevalidation = Date.now();
        await existinguser.save();
        return res.status(200).json({
            success: true,
            message: 'code sent!',
            user: {...existinguser._doc,
                password: undefined}
        })
    };
    res.status(200).json({
            success: true,
            message: 'code sent failed !'
        })

    } catch (error) {
        console.log(error)
    }
}


// verify code
const verifyverificationCode =  async (req, res) => {
    const {email , providedcode } = req.body;
    try {
        
        const { error, value } = acceptcodeschema.validate({email , providedcode});
        if (error) {
            return res.status(400).json({   
                success: false,
                message: error.details[0].message
            });
        }

        const codevalue = providedcode.toString();
        const existinguser = await user.findOne({email}).select('+verificationcode +verificationcodevalidation')
        if (!existinguser) {
         return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'user do not exist'
            });
    }
    if (existinguser.verified) {
         return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: 'You are alreadly verified'
            });
    }
if (
			!existinguser.verificationcode ||
			!existinguser.verificationcodevalidation
		) {
			return res
				.status(400)
				.json({ success: false, message: 'something is wrong with the code!' });
		}



    if (Date.now() - existinguser.verificationcodevalidation > 5* 60* 1000) {
          return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: "Code has been expired"
            });
    }

     const  hashedcodevalue = hmacprocess(codevalue, process.env.hmac_verification_secret);
     if (hashedcodevalue === existinguser.verificationcode) {
        existinguser.verified = true;
        existinguser.verificationcode = undefined;
        existinguser.verificationcodevalidation = undefined;

        await existinguser.save();
     return res.status(209).json({  // Changed to 409 Conflict for existing resources
                success: true,
                message: "Your account has been verified"
            });
        
     }

      return res.status(409).json({  // Changed to 409 Conflict for existing resources
                success: false,
                message: "unexpected error"
            });
    } catch (error) {
        console.log(error)
    }
}

// change pasword

const changePassword = async (req, res) => {
	const { userId, verified } = req.user;
	const { oldPassword, newPassword } = req.body;
	try {
		const { error, value } = changePasswordSchema.validate({
			oldPassword,
			newPassword,
		});
		if (error) {
			return res
				.status(401)
				.json({ success: false, message: error.details[0].message });
		}
		// if (!verified) {
		// 	return res
		// 		.status(401)
		// 		.json({ success: false, message: 'You are not verified user!' });
		// }
		const existinguser = await user.findOne({ _id: userId }).select(
			'+password'
		);
		if (!existinguser) {
			return res
				.status(401)
				.json({ success: false, message: 'User does not exists!' });
		}
		const result = await dohashvalidation(oldPassword, existinguser.password);
		if (!result) {
			return res
				.status(401)
				.json({ success: false, message: 'Invalid credentials!' });
		}
		const hashedPassword = await dohash(newPassword, 12);
		existinguser.password = hashedPassword;
		await existinguser.save();
		return res
			.status(200)
			.json({ success: true, message: 'Password updated!!' });
	} catch (error) {
		console.log(error);
	}
};
//send forgot password code
const sendforgotpassword = async (req, res) => {
	const { email } = req.body;
	try {
		const existinguser = await user.findOne({ email });
		if (!existinguser) {
			return res
				.status(404)
				.json({ success: false, message: 'User does not exists!' });
		}

		const codeValue = Math.floor(Math.random() * 1000000).toString();
		let info = await transport.sendMail({
			from: process.env.node_code_sending_address,
			to: existinguser.email,
			subject: 'Forgot password code',
			html: '<h1>' + codeValue + '</h1>',
		});

		if (info.accepted[0] === existinguser.email) {
			const hashedCodeValue = hmacprocess(
				codeValue,
				process.env.hmac_verification_secret
			);
			existinguser.forgotpassword = hashedCodeValue;
			existinguser.forgotpasswordcodevalidation = Date.now();
			await existinguser.save();
			return res.status(200).json({ success: true, message: 'Code sent!', user: {...existinguser._doc,
                password: undefined} });
		}
		res.status(400).json({ success: false, 
            message: 'Code sent failed!'

         });
	} catch (error) {
		console.log(error);
	}
};
// verify forgot password
const verifyforgotpasswordcode = async (req, res) => {
	const { email, providedCode, newPassword } = req.body;
	try {
		const { error, value } = acceptFPCodeSchema.validate({
			email,
			providedCode,
			newPassword,
		});
		if (error) {
			return res
				.status(401)
				.json({ success: false, message: error.details[0].message });
		}

		const codeValue = providedCode.toString();
		const existinguser = await user.findOne({ email }).select(
			'+forgotpassword +forgotpasswordcodevalidation'
		);

		if (!existinguser) {
			return res
				.status(401)
				.json({ success: false, message: 'User does not exists!' });
		}

		if (
			!existinguser.forgotpassword ||
			!existinguser.forgotpasswordcodevalidation
		) {
			return res
				.status(400)
				.json({ success: false, message: 'something is wrong with the code!' });
		}

		if (
			Date.now() - existinguser.forgotpasswordcodevalidation >
			5 * 60 * 1000
		) {
			return res
				.status(400)
				.json({ success: false, message: 'code has been expired!' });
		}

		const hashedCodeValue = hmacprocess(
			codeValue,
			process.env.hmac_verification_secret
		);

		if (hashedCodeValue === existinguser.forgotpassword) {
			const hashedPassword = await dohash(newPassword, 12);
			existinguser.password = hashedPassword;
			existinguser.forgotPassword = undefined;
			existinguser.forgotpasswordcodevalidation = undefined;
			await existinguser.save();
			return res
				.status(200)
				.json({ success: true, message: 'Password updated!!' });
		}
		return res
			.status(400)
			.json({ success: false, message: 'unexpected occured!!' });
	} catch (error) {
		console.log(error);
	}
};




module.exports = { signup, signin , signout, sendverification, verifyverificationCode, changePassword, sendforgotpassword, verifyforgotpasswordcode};