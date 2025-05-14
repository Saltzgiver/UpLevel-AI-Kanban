import { Link } from "wouter";
import { 
  Settings, 
  User,
  ChevronDown,
  Layout,
  FileText,
  Wrench,
  Bell,
  Upload,
  Globe,
  LogOut,
  Wand2,
  Image,
  Menu,
  X
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
import logoPath from "@/assets/logo.png";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";

interface NavigationBarProps {
  className?: string;
}

export function NavigationBar({ className }: NavigationBarProps) {
  // Mobile navigation items list
  const mobileNavigationItems = (
    <>
      <Link href="/" className="w-full">
        <MobileMenuItem icon={<Layout className="mr-2 h-4 w-4" />} label="Boards" />
      </Link>
      <Link href="/settings" className="w-full">
        <MobileMenuItem icon={<Settings className="mr-2 h-4 w-4" />} label="Settings" />
      </Link>
      <div className="py-2">
        <div className="h-px bg-gray-200 w-full" />
      </div>
      <div className="px-3 py-2 text-xs font-semibold text-gray-500">Developer Tools</div>
      <Link href="/workflow-generator-prompt" className="w-full">
        <MobileMenuItem icon={<Wand2 className="mr-2 h-4 w-4" />} label="Workflow Generator" />
      </Link>
      <Link href="/global-settings" className="w-full">
        <MobileMenuItem icon={<Globe className="mr-2 h-4 w-4" />} label="Global Settings" />
      </Link>
      <Link href="/image-api-test" className="w-full">
        <MobileMenuItem icon={<Image className="mr-2 h-4 w-4" />} label="Image API Test" />
      </Link>
      <Link href="/image-test" className="w-full">
        <MobileMenuItem icon={<Image className="mr-2 h-4 w-4" />} label="Mobile Image Test" />
      </Link>
    </>
  );

  return (
    <nav className={cn("bg-white border-b border-gray-200 py-2 px-2 sticky top-0 left-0 right-0 z-50 shadow-sm w-full", className)}>
      <div className="w-full flex items-center justify-between">
        {/* Logo - Smaller on mobile */}
        <Link href="/" className="flex items-center">
          <div className="w-7 h-7 rounded overflow-hidden mr-2">
            <img 
              src={logoPath}
              alt="UpLevel Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-semibold text-gray-900 text-sm">UpLevel</span>
        </Link>
        
        {/* Mobile Menu Button - Only visible on mobile */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 pt-4 w-[250px]">
              <SheetHeader className="px-4 pb-4 border-b">
                <SheetTitle className="flex items-center">
                  <div className="w-7 h-7 rounded overflow-hidden mr-2">
                    <img 
                      src={logoPath}
                      alt="UpLevel Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span>UpLevel Menu</span>
                </SheetTitle>
              </SheetHeader>
              <div className="py-4 overflow-y-auto">
                {mobileNavigationItems}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Desktop Navigation - Only visible on desktop */}
        <div className="hidden md:flex items-center space-x-3">
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
                <Link href="/profile" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Developer Tools</DropdownMenuLabel>
              <Link href="/workflow-generator-prompt" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Wand2 className="mr-2 h-4 w-4" />
                  <span>Workflow Generator Prompt</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/prompt-analyzer-settings" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Wrench className="mr-2 h-4 w-4" />
                  <span>Prompt Analyzer Settings</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/global-settings" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Globe className="mr-2 h-4 w-4" />
                  <span>Global Prompt Settings</span>
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
              <Link href="/image-api-test" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Image className="mr-2 h-4 w-4" />
                  <span>Image API Test</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

// Mobile menu item component for the side sheet
function MobileMenuItem({ icon, label, onClick }: { 
  icon: React.ReactNode; 
  label: string;
  onClick?: () => void;
}) {
  return (
    <SheetClose asChild>
      <button 
        className="flex items-center px-4 py-3 w-full text-left hover:bg-gray-50 text-sm"
        onClick={onClick}
      >
        {icon}
        <span>{label}</span>
      </button>
    </SheetClose>
  );
}