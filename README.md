<p align="center">
  <img src="./img.png" alt="Project Banner" width="100%">
</p>

# The Monroe Hangout🎯

## Basic Details

### Team Name: Monroe

### Team Members
- Member 1: Nicole Mercy Daison - Christ College of Engineering, Irinjalakkuda
- Member 2: Theresa Antony - Christ College of Engineering, Irinjalakkuda

### Hosted Project Link
[mention your project hosted link here]

### Project Description
is a real-time virtual hangout platform where paired users can listen to music, play games, and watch videos together in perfect sync. Using WebSocket technology and a vintage vinyl aesthetic, it creates an intimate shared space for long-distance friends to connect through synchronized activities.

### The Problem statement
Long-distance relationships lack a casual, low-pressure digital space to recreate the intimate feeling of just hanging out together in person.

### The Solution
A synchronized virtual space where you can truly hang out with one person, just like you would in real life.Think of it as your private lounge where you and your partner/best friend can:

 Listen to music together 
 Play casual games
 Watch videos side-by-side

---

## Technical Details

### Technologies/Components Used

React + Vite: fast frontend
Node.js + Express: backend server logic.
Socket.io: The "glue" that syncs your screen with your partner in real-time.
Tailwind CSS: UI/UX
YouTube API: Handles all the music and video playback.

Music Zone: Synchronized YouTube player with a private search proxy.
Games Zone: Real-time multiplayer Tic-Tac-Toe.
Dashboard: Room creator/joiner using unique "Frequency" codes.
Auth System: Secure Login/Signup using JWT (tokens) and encrypted passwords.
JSON Database: Simple, fast storage for users, rooms, and history logs.

---

## Features

List the key features of your project:
- High-Fidelity Music Sync: A shared YouTube player that stays perfectly in sync between partners, featuring a private search proxy for ad-free discovery.
- Ad-Free Privacy Proxy: By routing YouTube searches through a private backend proxy (Invidious), users enjoy a distraction-free experience without tracking or interruptions.
- Shared Memory Lane: A persistent history log that tracks every song played and game won, creating a digital scrapbook of your shared sessions.
- Follow-Partner Navigation: A "tethered" experience where if one partner enters a different zone (like switching from Music to Games), the other user is automatically navigated there too.

---

## Implementation


#### Installation
```npm install concurrently --save-dev, npm install express socket.io cors dotenv bcrypt jsonwebtoken uuid
```

#### Run
```npm run dev
```


---

## Project Documentation

### For Software:

#### Screenshots (Add at least 3)

#1
<img width="1366" height="720" alt="Monroe Experience - Google Chrome 14-02-2026 07_12_17" src="https://github.com/user-attachments/assets/c4546bfc-7c11-4055-933a-03aa8db7c70f" />
*This image shows the streaming service from youtube*

#2
<img width="1366" height="720" alt="Screenshot 14-02-2026 07_10_34" src="https://github.com/user-attachments/assets/770a12d0-4697-482b-8a9f-59d5c6c6353e" />
*This image shows music streaming in sync*

#3
<img width="1366" height="720" alt="Captures - File Explorer 14-02-2026 07_08_41" src="https://github.com/user-attachments/assets/33367998-2025-492a-bfe7-abdaab6dd5ab" />
*Homepage that the user sees*





Made with ❤️ at TinkerHub
