const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token
            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const optionalProtect = async (req, res, next) => {
    let token;

    // Check if the header exists and is formatted correctly
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];

        // Failsafe: Frontend sometimes accidentally sends "Bearer null"
        if (token === 'null' || token === 'undefined') {
            return next();
        }

        try {
            // Verify token and attach user to request
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            // Token is invalid or expired. Instead of throwing an error, 
            // we catch it silently and let them proceed as a guest.
            console.log("Optional Auth: Invalid token, proceeding as guest.");
        }
    }

    // Always move to the next function, whether they have a req.user or not
    next();
};

module.exports = { protect ,optionalProtect};