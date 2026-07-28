'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowRight, Zap } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATEGORY_META,
  inputFormatsFor,
  targetsFor,
} from '@/services/conversion/registry';
import { CATEGORIES, type Category } from '@/types/conversion';

/**
 * Quick Convert.
 *
 * Picks a route and jumps straight to its landing page with the output format
 * preselected, rather than duplicating the uploader here. That keeps one
 * implementation of the upload state machine and means the destination page is
 * the same prerendered one the rest of the site links to.
 */
export function QuickConvert() {
  const router = useRouter();

  const [category, setCategory] = useState<Category>('image');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  const sources = inputFormatsFor(category);
  const targets = source ? targetsFor(source) : [];

  function selectCategory(next: Category) {
    setCategory(next);
    setSource('');
    setTarget('');
  }

  function selectSource(next: string) {
    setSource(next);
    // The previous target may not be reachable from the new source.
    setTarget((current) =>
      targetsFor(next).some((format) => format.id === current) ? current : '',
    );
  }

  const ready = Boolean(source && target);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="size-4 text-primary" aria-hidden="true" />
          Quick convert
        </CardTitle>
        <CardDescription>
          Pick a route and go straight to the converter.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="quick-category"
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </label>
            <Select
              value={category}
              onValueChange={(value) => selectCategory(value as Category)}
            >
              <SelectTrigger id="quick-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {CATEGORY_META[item].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="quick-source"
              className="text-xs font-medium text-muted-foreground"
            >
              From
            </label>
            <Select value={source} onValueChange={selectSource}>
              <SelectTrigger id="quick-source">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="quick-target"
              className="text-xs font-medium text-muted-foreground"
            >
              To
            </label>
            <Select value={target} onValueChange={setTarget} disabled={!source}>
              <SelectTrigger id="quick-target">
                <SelectValue
                  placeholder={source ? 'Format' : 'Pick a source'}
                />
              </SelectTrigger>
              <SelectContent>
                {targets.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!ready}
          onClick={() => router.push(`/tools/${source}-to-${target}`)}
        >
          {ready
            ? `Convert ${source.toUpperCase()} to ${target.toUpperCase()}`
            : 'Choose both formats'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}
