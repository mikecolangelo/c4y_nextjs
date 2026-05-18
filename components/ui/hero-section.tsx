import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter,CardTitle} from "@/components_shadcn/ui/card";
import Image from "next/image";
import Link from "next/link";
import type { HeroSectionData } from "@/validations/types";

export function HeroSection({ data }: { readonly data: Readonly<HeroSectionData> }) {
  if (!data) return null;

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Card className="w-1/2 h-1/2 flex flex-col items-center justify-center gap-4">
        <CardHeader>
          <CardTitle>{data.heading}</CardTitle>
          <CardDescription>{data.sub_heading}</CardDescription>
        </CardHeader>
        <CardContent>
          <Image src={data.image.url} alt={data.image.alternativeText} width={100} height={100} quality={90}  />
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline" size="lg">
            {data.link.isExternal ? (
              <Link href={data.link.href} target="_blank" rel="noopener noreferrer">{data.link.label}</Link>
            ) : (
              <Link href={data.link.href}>{data.link.label}</Link>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}