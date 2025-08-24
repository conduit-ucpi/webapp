'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/lib/auth/AuthContextProvider';

const AnimatedMoneyFlow = () => {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <svg viewBox="0 0 400 300" className="w-full h-auto">
        {/* Background circles */}
        <motion.circle
          cx="100" cy="80" r="40"
          fill="#f0fdf4" stroke="#10b981" strokeWidth="2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        />
        <motion.circle
          cx="200" cy="150" r="45"
          fill="#eff6ff" stroke="#3b82f6" strokeWidth="2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        />
        <motion.circle
          cx="300" cy="80" r="40"
          fill="#f0fdf4" stroke="#10b981" strokeWidth="2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        />

        {/* Labels */}
        <motion.text
          x="100" y="90" textAnchor="middle" 
          className="text-sm font-semibold fill-secondary-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Buyer
        </motion.text>
        <motion.text
          x="200" y="160" textAnchor="middle"
          className="text-sm font-semibold fill-secondary-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          Escrow
        </motion.text>
        <motion.text
          x="300" y="90" textAnchor="middle"
          className="text-sm font-semibold fill-secondary-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Seller
        </motion.text>

        {/* Animated money flow arrows */}
        <motion.path
          d="M 140 80 Q 170 120 160 150"
          stroke="#10b981" strokeWidth="3" fill="none"
          strokeDasharray="0 1000"
          initial={{ strokeDasharray: "0 1000" }}
          animate={{ strokeDasharray: "1000 0" }}
          transition={{ delay: 1.5, duration: 1.5, ease: "easeInOut" }}
        />
        <motion.path
          d="M 240 150 Q 270 120 260 80"
          stroke="#10b981" strokeWidth="3" fill="none"
          strokeDasharray="0 1000"
          initial={{ strokeDasharray: "0 1000" }}
          animate={{ strokeDasharray: "1000 0" }}
          transition={{ delay: 3.0, duration: 1.5, ease: "easeInOut" }}
        />

        {/* Arrow heads */}
        <motion.polygon
          points="155,145 165,150 155,155"
          fill="#10b981"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.8, duration: 0.3 }}
        />
        <motion.polygon
          points="265,85 255,80 265,75"
          fill="#10b981"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 4.3, duration: 0.3 }}
        />

        {/* Dollar signs floating */}
        <motion.text
          x="130" y="110" textAnchor="middle"
          className="text-lg font-bold fill-primary-600"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
          transition={{ delay: 1.5, duration: 2, ease: "easeInOut" }}
        >
          $
        </motion.text>
        <motion.text
          x="270" y="110" textAnchor="middle"
          className="text-lg font-bold fill-primary-600"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
          transition={{ delay: 3.0, duration: 2, ease: "easeInOut" }}
        >
          $
        </motion.text>

        {/* Shield icon in escrow */}
        <motion.path
          d="M190 140 L195 135 L205 135 L210 140 L210 150 C210 155 205 160 200 160 C195 160 190 155 190 150 Z"
          fill="#3b82f6"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
        />
        <motion.path
          d="M195 145 L198 148 L205 141"
          stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        />
      </svg>

      {/* Floating particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary-300 rounded-full"
          style={{
            left: `${20 + i * 12}%`,
            top: `${30 + (i % 2) * 40}%`,
          }}
          animate={{
            y: [-10, 10, -10],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            repeat: Infinity,
            duration: 3 + i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default function AnimatedHero() {
  const { user, isLoading } = useAuth();
  const { isConnected, isConnecting } = useAuthContext();

  const isAuthenticated = user && isConnected;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="space-y-8">
        <motion.h1
          className="text-5xl font-bold text-secondary-900 dark:text-white lg:text-6xl xl:text-7xl leading-tight"
          variants={itemVariants}
        >
          Get Paid Safely,
          <motion.span
            className="text-primary-600 dark:text-primary-400 block"
            variants={itemVariants}
          >
            Automatically
          </motion.span>
        </motion.h1>

        <motion.p
          className="text-xl text-secondary-700 dark:text-secondary-300 font-medium"
          variants={itemVariants}
        >
          Escrow protection made simple - no lawyers, no banks, just security
        </motion.p>

        <motion.p
          className="text-lg text-secondary-600 dark:text-secondary-400 max-w-lg"
          variants={itemVariants}
        >
          <span className="font-semibold text-secondary-900 dark:text-white">Smart escrow</span> that releases payments automatically when agreed time passes - with dispute protection if things go wrong.
        </motion.p>

        <motion.div className="pt-6" variants={itemVariants}>
          {isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/create">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold">
                    Create Payment Request
                  </Button>
                </motion.div>
              </Link>
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
                    View Dashboard
                  </Button>
                </motion.div>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ConnectWallet />
              </motion.div>
              <div className="text-sm text-secondary-600 max-w-md">
                <p className="mb-2">
                  Connect with Google, Facebook, or any social login.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Animated Hero Graphic */}
      <motion.div
        className="hidden lg:flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <AnimatedMoneyFlow />
      </motion.div>
    </motion.div>
  );
}