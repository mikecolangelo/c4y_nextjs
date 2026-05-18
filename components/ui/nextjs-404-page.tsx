import { Card, CardHeader, CardTitle, CardDescription } from "@/components_shadcn/ui/card";

export function Nextjs404Page({ title, description }: { readonly title: string, readonly  description: string }) {
  return (
    <>
      <html>
        <head>
          <title>{title}</title>
          <meta name="description" content={description} />
        </head>
      </html>
      <body>
        <main>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </body>
    </>
  );
}