"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Clock, Calendar as CalendarIcon, Info, Zap, Repeat, Timer, Target } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { TriggerProvider, ScheduleTriggerConfig } from '../types';
import { useAgentWorkflows } from '@/hooks/react-query/agents/use-agent-workflows';

interface ScheduleTriggerConfigFormProps {
  provider: TriggerProvider;
  config: ScheduleTriggerConfig;
  onChange: (config: ScheduleTriggerConfig) => void;
  errors: Record<string, string>;
  agentId: string;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

type ScheduleType = 'quick' | 'recurring' | 'advanced' | 'one-time';

type VariableType = 'string' | 'number' | 'boolean' | 'select' | 'multiselect';

interface VariableSpec {
  key: string;
  label: string;
  type: VariableType;
  required?: boolean;
  options?: string[];
  default?: string | number | boolean | string[];
  helperText?: string;
}

interface QuickPreset {
  name: string;
  cron: string;
  description: string;
  icon: React.ReactNode;
  category: 'frequent' | 'daily' | 'weekly' | 'monthly';
}

const QUICK_PRESETS: QuickPreset[] = [
  { name: 'Every minute', cron: '* * * * *', description: 'Every minute', icon: <Zap className="h-4 w-4" />, category: 'frequent' },
  { name: 'Every 5 minutes', cron: '*/5 * * * *', description: 'Every 5 minutes', icon: <Timer className="h-4 w-4" />, category: 'frequent' },
  { name: 'Every 15 minutes', cron: '*/15 * * * *', description: 'Every 15 minutes', icon: <Timer className="h-4 w-4" />, category: 'frequent' },
  { name: 'Every 30 minutes', cron: '*/30 * * * *', description: 'Every 30 minutes', icon: <Timer className="h-4 w-4" />, category: 'frequent' },
  { name: 'Every hour', cron: '0 * * * *', description: 'At the start of every hour', icon: <Clock className="h-4 w-4" />, category: 'frequent' },

  { name: 'Daily at 9 AM', cron: '0 9 * * *', description: 'Every day at 9:00 AM', icon: <Target className="h-4 w-4" />, category: 'daily' },
  { name: 'Daily at 12 PM', cron: '0 12 * * *', description: 'Every day at 12:00 PM', icon: <Target className="h-4 w-4" />, category: 'daily' },
  { name: 'Daily at 6 PM', cron: '0 18 * * *', description: 'Every day at 6:00 PM', icon: <Target className="h-4 w-4" />, category: 'daily' },
  { name: 'Twice daily', cron: '0 9,17 * * *', description: 'Every day at 9 AM and 5 PM', icon: <Repeat className="h-4 w-4" />, category: 'daily' },

  { name: 'Weekdays at 9 AM', cron: '0 9 * * 1-5', description: 'Monday-Friday at 9:00 AM', icon: <Target className="h-4 w-4" />, category: 'weekly' },
  { name: 'Monday mornings', cron: '0 9 * * 1', description: 'Every Monday at 9:00 AM', icon: <CalendarIcon className="h-4 w-4" />, category: 'weekly' },
  { name: 'Friday evenings', cron: '0 17 * * 5', description: 'Every Friday at 5:00 PM', icon: <CalendarIcon className="h-4 w-4" />, category: 'weekly' },
  { name: 'Weekend mornings', cron: '0 10 * * 0,6', description: 'Saturday & Sunday at 10:00 AM', icon: <CalendarIcon className="h-4 w-4" />, category: 'weekly' },

  { name: 'Monthly on 1st', cron: '0 9 1 * *', description: 'First day of month at 9:00 AM', icon: <CalendarIcon className="h-4 w-4" />, category: 'monthly' },
  { name: 'Monthly on 15th', cron: '0 9 15 * *', description: '15th of month at 9:00 AM', icon: <CalendarIcon className="h-4 w-4" />, category: 'monthly' },
  { name: 'End of month', cron: '0 9 28-31 * *', description: 'Last few days of month at 9:00 AM', icon: <CalendarIcon className="h-4 w-4" />, category: 'monthly' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const WEEKDAYS = [
  { value: '1', label: 'Monday', short: 'Mon' },
  { value: '2', label: 'Tuesday', short: 'Tue' },
  { value: '3', label: 'Wednesday', short: 'Wed' },
  { value: '4', label: 'Thursday', short: 'Thu' },
  { value: '5', label: 'Friday', short: 'Fri' },
  { value: '6', label: 'Saturday', short: 'Sat' },
  { value: '0', label: 'Sunday', short: 'Sun' },
];

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const ScheduleTriggerConfigForm: React.FC<ScheduleTriggerConfigFormProps> = ({
  provider,
  config,
  onChange,
  errors,
  agentId,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  isActive,
  onActiveChange,
}) => {
  const { data: workflows = [], isLoading: isLoadingWorkflows } = useAgentWorkflows(agentId);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('quick');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const [recurringType, setRecurringType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['*']);
  const [dayOfMonth, setDayOfMonth] = useState<string>('1');
  const [scheduleTime, setScheduleTime] = useState<{ hour: string; minute: string }>({ hour: '09', minute: '00' });

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [oneTimeTime, setOneTimeTime] = useState<{ hour: string; minute: string }>({ hour: '09', minute: '00' });

  const selectedWorkflow = useMemo(() => {
    return (workflows || []).find((w) => w.id === config.workflow_id);
  }, [workflows, config.workflow_id]);

  const { variableSpecs, templateText } = useMemo(() => {
    if (!selectedWorkflow) return { variableSpecs: [] as VariableSpec[], templateText: '' };
    const stepsAny = ((selectedWorkflow as any)?.steps as any[]) || [];
    const start = stepsAny.find(
      (s: any) => s?.name === 'Start' && s?.description === 'Click to add steps or use the Add Node button',
    );
    const child = start?.children?.[0] ?? stepsAny[0];
    const vars = (child?.config?.playbook?.variables as VariableSpec[]) || [];
    const tpl = (child?.config?.playbook?.template as string) || '';
    return { variableSpecs: vars, templateText: tpl };
  }, [selectedWorkflow]);

  // Initialize defaults for variable inputs when workflow changes or dialog loads
  useEffect(() => {
    if (!selectedWorkflow || config.execution_type !== 'workflow') return;
    if (!variableSpecs || variableSpecs.length === 0) return;
    const defaults: Record<string, any> = {};
    for (const v of variableSpecs) {
      if (v.default !== undefined && (config.workflow_input?.[v.key] === undefined)) {
        defaults[v.key] = v.default;
      }
    }
    if (Object.keys(defaults).length > 0) {
      onChange({
        ...config,
        workflow_input: { ...(config.workflow_input || {}), ...defaults },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflow?.id, config.execution_type]);

  const handleVarChange = useCallback((key: string, value: any) => {
    onChange({
      ...config,
      workflow_input: { ...(config.workflow_input || {}), [key]: value },
    });
  }, [config, onChange]);

  useEffect(() => {
    if (!config.timezone) {
      try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        onChange({
          ...config,
          timezone: detectedTimezone,
        });
      } catch (error) {
        onChange({
          ...config,
          timezone: 'UTC',
        });
      }
    }
  }, []);

  useEffect(() => {
    if (config.cron_expression) {
      const preset = QUICK_PRESETS.find(p => p.cron === config.cron_expression);
      if (preset) {
        setScheduleType('quick');
        setSelectedPreset(config.cron_expression);
      } else {
        setScheduleType('advanced');
      }
    }
  }, [config.cron_expression]);

  const generateCronExpression = () => {
    if (scheduleType === 'quick' && selectedPreset) {
      return selectedPreset;
    }
    if (scheduleType === 'recurring') {
      const { hour, minute } = scheduleTime;
      switch (recurringType) {
        case 'daily':
          return `${minute} ${hour} * * *`;
        case 'weekly':
          const weekdayStr = selectedWeekdays.join(',');
          return `${minute} ${hour} * * ${weekdayStr}`;
        case 'monthly':
          const monthStr = selectedMonths.includes('*') ? '*' : selectedMonths.join(',');
          return `${minute} ${hour} ${dayOfMonth} ${monthStr} *`;
        default:
          return `${minute} ${hour} * * *`;
      }
    }
    if (scheduleType === 'one-time' && selectedDate) {
      const { hour, minute } = oneTimeTime;
      const day = selectedDate.getDate();
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      return `${minute} ${hour} ${day} ${month} *`;
    }
    return config.cron_expression || '';
  };

  useEffect(() => {
    const newCron = generateCronExpression();
    if (newCron && newCron !== config.cron_expression) {
      onChange({
        ...config,
        cron_expression: newCron,
      });
    }
  }, [scheduleType, selectedPreset, recurringType, selectedWeekdays, selectedMonths, dayOfMonth, scheduleTime, selectedDate, oneTimeTime]);

  const handlePresetSelect = (preset: QuickPreset) => {
    setSelectedPreset(preset.cron);
    onChange({
      ...config,
      cron_expression: preset.cron,
    });
  };

  const handleAgentPromptChange = (value: string) => {
    onChange({
      ...config,
      agent_prompt: value,
    });
  };

  const handleTimezoneChange = (value: string) => {
    onChange({
      ...config,
      timezone: value,
    });
  };

  const getSchedulePreview = () => {
    if (!config.cron_expression) return null;

    try {
      const descriptions: Record<string, string> = {
        '0 9 * * *': 'Every day at 9:00 AM',
        '0 18 * * *': 'Every day at 6:00 PM',
        '0 9 * * 1-5': 'Weekdays at 9:00 AM',
        '0 10 * * 1-5': 'Weekdays at 10:00 AM',
        '0 9 * * 1': 'Every Monday at 9:00 AM',
        '0 9 1 * *': 'Monthly on the 1st at 9:00 AM',
        '0 */2 * * *': 'Every 2 hours',
        '*/30 * * * *': 'Every 30 minutes',
        '0 0 * * *': 'Every day at midnight',
        '0 12 * * *': 'Every day at noon',
      };

      return descriptions[config.cron_expression] || config.cron_expression;
    } catch {
      return config.cron_expression;
    }
  };

  const handleExecutionTypeChange = (value: 'agent' | 'workflow') => {
    const newConfig = {
      ...config,
      execution_type: value,
    };
    if (value === 'agent') {
      delete newConfig.workflow_id;
      delete newConfig.workflow_input;
    } else {
      delete newConfig.agent_prompt;
      if (!newConfig.workflow_input) {
        newConfig.workflow_input = { prompt: '' };
      }
    }
    onChange(newConfig);
  };

  const handleWorkflowChange = (workflowId: string) => {
    if (workflowId.startsWith('__')) {
      return;
    }
    onChange({
      ...config,
      workflow_id: workflowId,
      // reset inputs when switching playbooks to avoid leaking old keys
      workflow_input: {},
    });
  };

  const handleWeekdayToggle = (weekday: string) => {
    setSelectedWeekdays(prev =>
      prev.includes(weekday)
        ? prev.filter(w => w !== weekday)
        : [...prev, weekday].sort()
    );
  };

  const handleMonthToggle = (month: string) => {
    if (month === '*') {
      setSelectedMonths(['*']);
    } else {
      setSelectedMonths(prev => {
        const filtered = prev.filter(m => m !== '*');
        return filtered.includes(month)
          ? filtered.filter(m => m !== month)
          : [...filtered, month].sort((a, b) => parseInt(a) - parseInt(b));
      });
    }
  };

  const groupedPresets = QUICK_PRESETS.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, QuickPreset[]>);

  return (
    <div className="space-y-6">
      <Card className="border-none bg-transparent shadow-none p-0">
        <CardHeader className='p-0'>
          <CardDescription>
            Configure when your agent should be triggered automatically. Choose from quick presets, recurring schedules, or set up advanced cron expressions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Trigger Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="trigger-name">Name *</Label>
                    <Input
                      id="trigger-name"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Enter a name for this trigger"
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trigger-description">Description</Label>
                    <Textarea
                      id="trigger-description"
                      value={description}
                      onChange={(e) => onDescriptionChange(e.target.value)}
                      placeholder="Optional description for this trigger"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="trigger-active"
                      checked={isActive}
                      onCheckedChange={onActiveChange}
                    />
                    <Label htmlFor="trigger-active">
                      Enable trigger immediately
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Execution Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      Execution Type *
                    </Label>
                    <RadioGroup value={config.execution_type || 'agent'} onValueChange={handleExecutionTypeChange}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="agent" id="execution-agent" />
                        <Label htmlFor="execution-agent">Execute Agent</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="workflow" id="execution-workflow" />
                        <Label htmlFor="execution-workflow">Execute Workflow</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose whether to execute the agent directly or run a specific workflow.
                    </p>
                  </div>

                  {config.execution_type === 'workflow' ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="workflow_id" className="text-sm font-medium">
                          Workflow *
                        </Label>
                        <Select value={config.workflow_id || ''} onValueChange={handleWorkflowChange}>
                          <SelectTrigger className={cn('max-w-[28rem] w-full overflow-hidden', errors.workflow_id ? 'border-destructive' : '')}>
                            <SelectValue className="truncate" placeholder="Select a workflow" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[28rem]">
                            {isLoadingWorkflows ? (
                              <SelectItem value="__loading__" disabled>Loading workflows...</SelectItem>
                            ) : workflows.length === 0 ? (
                              <SelectItem value="__no_workflows__" disabled>No workflows available</SelectItem>
                            ) : (
                              workflows.filter(w => w.status === 'active').map((workflow) => (
                                <SelectItem key={workflow.id} value={workflow.id}>
                                  <span className="block truncate max-w-[26rem]">{workflow.name}</span>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {errors.workflow_id && (
                          <p className="text-xs text-destructive mt-1">{errors.workflow_id}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Select the workflow to execute when triggered.
                        </p>
                      </div>

                      {templateText ? (
                        <div className="rounded-xl border p-3 bg-muted/30 max-h-[160px] overflow-y-auto">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{templateText}</p>
                        </div>
                      ) : null}

                      {variableSpecs && variableSpecs.length > 0 ? (
                        <div className="space-y-3">
                          {variableSpecs.map((v) => (
                            <div key={v.key} className="space-y-1">
                              <Label htmlFor={`v-${v.key}`}>{v.label}</Label>
                              <Input
                                id={`v-${v.key}`}
                                type={v.type === 'number' ? 'number' : 'text'}
                                value={(config.workflow_input?.[v.key] ?? '') as any}
                                onChange={(e) => handleVarChange(v.key, v.type === 'number' ? Number(e.target.value) : e.target.value)}
                                placeholder={v.helperText || ''}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor="workflow_input" className="text-sm font-medium">
                            Instructions for Workflow
                          </Label>
                          <Textarea
                            id="workflow_input"
                            value={config.workflow_input?.prompt || config.workflow_input?.message || ''}
                            onChange={(e) => {
                              onChange({
                                ...config,
                                workflow_input: { prompt: e.target.value },
                              });
                            }}
                            placeholder="Write what you want the workflow to do..."
                            rows={4}
                            className={errors.workflow_input ? 'border-destructive' : ''}
                          />
                          {errors.workflow_input && (
                            <p className="text-xs text-destructive mt-1">{errors.workflow_input}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Simply describe what you want the workflow to accomplish. The workflow will interpret your instructions naturally.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="agent_prompt" className="text-sm font-medium">
                        Agent Prompt *
                      </Label>
                      <Textarea
                        id="agent_prompt"
                        value={config.agent_prompt || ''}
                        onChange={(e) => handleAgentPromptChange(e.target.value)}
                        placeholder="Enter the prompt that will be sent to your agent when triggered..."
                        rows={4}
                        className={errors.agent_prompt ? 'border-destructive' : ''}
                      />
                      {errors.agent_prompt && (
                        <p className="text-xs text-destructive mt-1">{errors.agent_prompt}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        This prompt will be sent to your agent each time the schedule triggers.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule Configuration
                </h3>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="timezone" className="text-sm font-medium">
                      Timezone
                      <span className="text-xs text-muted-foreground ml-2">
                        (Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                      </span>
                    </Label>
                    <Select value={config.timezone || 'UTC'} onValueChange={handleTimezoneChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            <div className="flex items-center justify-between w-full">
                              <span>{tz.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date().toLocaleTimeString('en-US', {
                                  timeZone: tz.value,
                                  hour12: false,
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {config.timezone && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Current time: {new Date().toLocaleString('en-US', {
                          timeZone: config.timezone,
                          hour12: true,
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>

                  <Tabs value={scheduleType} onValueChange={(value) => setScheduleType(value as ScheduleType)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="quick" className="flex items-center gap-1 px-2">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">Quick</span>
                      </TabsTrigger>
                      <TabsTrigger value="recurring" className="flex items-center gap-1 px-2">
                        <Repeat className="h-4 w-4" />
                        <span className="hidden sm:inline">Recurring</span>
                      </TabsTrigger>
                      <TabsTrigger value="one-time" className="flex items-center gap-1 px-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">One-time</span>
                      </TabsTrigger>
                      <TabsTrigger value="advanced" className="flex items-center gap-1 px-2">
                        <Target className="h-4 w-4" />
                        <span className="hidden sm:inline">Advanced</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="quick" className="space-y-4 mt-6">
                      <div className="space-y-4">
                        {Object.entries(groupedPresets).map(([category, presets]) => (
                          <div key={category}>
                            <h4 className="text-sm font-medium mb-3 capitalize">{category} Schedules</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {presets.map((preset) => (
                                <Card
                                  key={preset.cron}
                                  className={cn(
                                    "p-0 cursor-pointer transition-colors hover:bg-accent",
                                    selectedPreset === preset.cron && "ring-2 ring-primary bg-accent"
                                  )}
                                  onClick={() => handlePresetSelect(preset)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="text-primary">{preset.icon}</div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{preset.name}</div>
                                        <div className="text-xs text-muted-foreground">{preset.description}</div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="recurring" className="space-y-6 mt-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Schedule Type</Label>
                          <RadioGroup value={recurringType} onValueChange={(value) => setRecurringType(value as any)}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="daily" id="daily" />
                              <Label htmlFor="daily">Daily</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="weekly" id="weekly" />
                              <Label htmlFor="weekly">Weekly</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="monthly" id="monthly" />
                              <Label htmlFor="monthly">Monthly</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {recurringType === 'weekly' && (
                          <div>
                            <Label className="text-sm font-medium mb-3 block">Days of Week</Label>
                            <div className="flex flex-wrap gap-2">
                              {WEEKDAYS.map((day) => (
                                <Button
                                  key={day.value}
                                  variant={selectedWeekdays.includes(day.value) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleWeekdayToggle(day.value)}
                                >
                                  {day.short}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {recurringType === 'monthly' && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium mb-3 block">Day of Month</Label>
                              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 31 }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-3 block">Months</Label>
                              <div className="space-y-2">
                                <Button
                                  variant={selectedMonths.includes('*') ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleMonthToggle('*')}
                                >
                                  All Months
                                </Button>
                                <div className="grid grid-cols-3 gap-2">
                                  {MONTHS.map((month) => (
                                    <Button
                                      key={month.value}
                                      variant={selectedMonths.includes(month.value) ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => handleMonthToggle(month.value)}
                                      disabled={selectedMonths.includes('*')}
                                    >
                                      {month.label.slice(0, 3)}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="text-sm font-medium mb-3 block">Time</Label>
                          <div className="flex gap-2 items-center">
                            <Select value={scheduleTime.hour} onValueChange={(value) => setScheduleTime(prev => ({ ...prev, hour: value }))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span>:</span>
                            <Select value={scheduleTime.minute} onValueChange={(value) => setScheduleTime(prev => ({ ...prev, minute: value }))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 60 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="one-time" className="space-y-6 mt-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-3 block">Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !selectedDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(date) => date < startOfDay(new Date())}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-3 block">Time</Label>
                          <div className="flex gap-2 items-center">
                            <Select value={oneTimeTime.hour} onValueChange={(value) => setOneTimeTime(prev => ({ ...prev, hour: value }))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span>:</span>
                            <Select value={oneTimeTime.minute} onValueChange={(value) => setOneTimeTime(prev => ({ ...prev, minute: value }))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 60 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                    {i.toString().padStart(2, '0')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="advanced" className="space-y-4 mt-6">
                      <div>
                        <Label htmlFor="cron_expression" className="text-sm font-medium">
                          Cron Expression *
                        </Label>
                        <Input
                          id="cron_expression"
                          type="text"
                          value={config.cron_expression || ''}
                          onChange={(e) => onChange({ ...config, cron_expression: e.target.value })}
                          placeholder="0 9 * * 1-5"
                          className={errors.cron_expression ? 'border-destructive' : ''}
                        />
                        {errors.cron_expression && (
                          <p className="text-xs text-destructive mt-1">{errors.cron_expression}</p>
                        )}
                        {config.cron_expression && !errors.cron_expression && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {getSchedulePreview()}
                          </p>
                        )}
                        <Card className="mt-3 p-0 py-4">
                          <CardContent>
                            <div className="flex items-center gap-2 mb-2">
                              <Info className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Cron Format</span>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Format: <code className="bg-muted px-1 rounded text-xs">minute hour day month weekday</code></div>
                              <div>Example: <code className="bg-muted px-1 rounded text-xs">0 9 * * 1-5</code> = Weekdays at 9 AM</div>
                              <div>Use <code className="bg-muted px-1 rounded text-xs">*</code> for any value, <code className="bg-muted px-1 rounded text-xs">*/5</code> for every 5 units</div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                  {config.cron_expression && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Schedule Preview
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{getSchedulePreview()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{config.timezone || 'UTC'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm capitalize">{config.execution_type || 'agent'} execution</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
