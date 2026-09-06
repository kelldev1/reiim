# Reiim - Study Workload Manager

Reiim is a Windows-native application designed to help manage study workload through an interactive calendar interface. The application provides a visual representation of your schedule with meeting information, hover effects, and animated transitions for an engaging user experience.

## Features

- **Interactive Calendar**: View your schedule in a clean, grid-based layout
- **Hover Effects**: See meeting counts and details when hovering over calendar days
- **Animated Transitions**: Smooth animations using Framer Motion for view transitions and item reveal
- **Responsive Design**: Adapts to different screen sizes with a flexible layout
- **Meeting Details**: View detailed information about scheduled events including time, title, participants, and location
- **Glassmorphism Design**: Modern translucent glass theme throughout the application

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the project directory:
   ```bash
   cd reiim
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Production Build

To create a production build:
```bash
npm run build
```

To preview the production build:
```bash
npm run preview
```

## Project Structure

```
reiim/
├── src/
│   ├── components/
│   │   └── ui/
│   │       └── visualize-booking.tsx  # Main calendar component
│   ├── App.tsx                      # Root component
│   └── main.tsx                     # Entry point
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

## Customization

The calendar data is defined in the `DAYS` array within `src/components/ui/visualize-booking.tsx`. You can modify this array to reflect your own schedule:

```typescript
const DAYS: DayType[] = [
  {
    day: '02',
    classNames: 'bg-[#1e1e1e] cursor-pointer',
    meetingInfo: [
      {
        date: 'Wed, 2 Nov',
        time: '10:00 AM - 11:00 AM',
        title: 'Design Review Meeting',
        participants: ['Alice Johnson', 'Mark Lee'],
        location: 'Zoom',
      },
      // ... more meetings
    ],
  },
  // ... more days
];
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and all rights are reserved.

## Acknowledgments

- Inspired by modern calendar and scheduling applications
- Built with ❤️ using React and Tailwind CSS