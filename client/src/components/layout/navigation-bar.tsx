import { Link } from "wouter";
import { 
  Settings, 
  User,
  ChevronDown,
  Layout,
  FileText,
  Wrench,
  Bell,
  Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavigationBarProps {
  className?: string;
}

export function NavigationBar({ className }: NavigationBarProps) {
  return (
    <nav className={cn("bg-white border-b border-gray-200 py-2.5 px-4 sticky top-0 left-0 right-0 z-50 shadow-sm w-full", className)}>
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center space-x-5">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="w-8 h-8 rounded bg-primary/90 flex items-center justify-center text-white mr-2">
              <svg 
                viewBox="0 0 24 24" 
                className="w-5 h-5" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M4 12H20M12 4V20" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Kanban</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full"
          >
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>
          
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 rounded-full flex items-center">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-medium border border-violet-200">
                  <User className="h-4 w-4" />
                </div>
                <ChevronDown className="ml-1 h-4 w-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Admin</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    admin@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href="/" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Layout className="mr-2 h-4 w-4" />
                    <span>Boards</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Developer Tools</DropdownMenuLabel>
                <Link href="/prompt-analyzer-settings" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Wrench className="mr-2 h-4 w-4" />
                    <span>Prompt Analyzer Settings</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/test-upload" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    <span>Test Upload</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/test-suggestion" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Test Suggestion</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/direct-toast-test" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Direct Toast Test</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}