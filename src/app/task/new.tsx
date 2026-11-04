import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { TaskForm } from '../../components/TaskForm';
import { useToast } from '../../components/Toast';
import { useStore } from '../../state/store';

export default function NewTaskScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { createTask, today } = useStore();
  const toast = useToast();
  const defaultDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  return (
    <TaskForm
      defaultDate={defaultDate}
      submitLabel="حفظ المهمة"
      onSubmit={async (input) => {
        await createTask(input);
        toast(input.dueDate > today ? 'أُضيفت إلى المهام القادمة ✓' : 'أُضيفت إلى مهام اليوم ✓');
        router.back();
      }}
    />
  );
}
