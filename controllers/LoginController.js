const express = require('express')
const { validationResult } = require('express-validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../prisma/client')

const login = async (req, res) => {
    const errors = validationResult(req)

    if(!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: "Validation error",
            errors: errors.array()
        })
    }

    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server auth is not configured (JWT_SECRET missing)"
            })
        }

        const user = await prisma.user.findFirst({
            where: {
                email: req.body.email
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
                password: true
            }
        })

        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: "Account has no password set"
            })
        }

        const validPassword = await bcrypt.compare(
            req.body.password, 
            user.password
        )

        if(!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            })
        }

        const token = jwt.sign({
            id: user.id
        }, process.env.JWT_SECRET, {expiresIn: '7d'})

        const {password, ...userWithoutPassword} = user

        res.status(200).send({
            success: true,
            message: "Login successful",
            data: {
                user: userWithoutPassword,
                token: token
            }
        })
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send({
            success: false,
            message: "Internal server error",
        }) 
    } 
}

module.exports = {login}
