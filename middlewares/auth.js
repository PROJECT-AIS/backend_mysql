const express = require('express')
const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
    let token = req.headers['authorization']
    if (!token) return res.status(401).json({message: 'Unauthenticated'});

    // Strip 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) return res.status(401).json({message: 'Invalid token'});

        req.userId = decoded.id;
        next()
    })
}

module.exports = verifyToken;