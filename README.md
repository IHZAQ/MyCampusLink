# Documentation for MyCampusLink

## Introduction

### Project Name

**MyCampusLink** (originally mycampuslink)

### Description

This projects was originally made for UTP students uses but made it open sources for other campus as well.

It was designed to help students in campus to share their links for events forms, recruitment drive forms, and many more.

### Tech Stack

Using Node.js as engine and Express library for user-experiences.

## How to host

Prerequisites:
| Software | Version|
|---|---|
|Node.js| V24 and above|
|MongoDB (if hosted locally) | 8.2.7 and above|

Installation:
1. Download or clone this repository.
2. Run `npm install` to install all required library.
3. Make a MongoDB server (for storing user data):
    1. Locally: Download and install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and use `mongodb://localhost:27017/urlshortener` url in [.env](.env.example)
    2. Online: Go to [MongoDB](https://mongodb.com) and register your accounts, and make a cluster database and copy the mongodb string and use it in [.env](.env.example)
4. Generate a [JWT Secret Key](https://jwtsecretkeygenerator.com/) and put it in [.env](.env.example)
5. Put the server url in [.env](.env.example) like vercel
6. Make sure information in [.env](.env.example) are filled in and file name is renamed to .env

IHZAQ © 2026