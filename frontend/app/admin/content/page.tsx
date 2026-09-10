"use client";

import { useState } from 'react';
import Link from 'next/link';
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralBadge } from "@/components/neural/NeuralBadge";
import { NeuralIconButton } from "@/components/neural/NeuralIconButton";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { Modal, ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    ChevronLeft,
    Plus,
    Edit,
    Trash2,
    Save,
    FolderOpen,
    FileText,
    GripVertical,
    ChevronRight,
    BookOpen
} from "lucide-react";

interface Subtopic {
    id: string;
    title: string;
    content?: string;
    difficulty: number;
    textbook_reference?: string;
}

interface Unit {
    id: string;
    title: string;
    order: number;
    subtopics: Subtopic[];
}

interface Course {
    id: string;
    title: string;
    description: string;
    units: Unit[];
}

const TEXTBOOK_OPTIONS = [
    "Elmasri & Navathe",
    "Pramod J Sadalage & Martin Fowler",
    "Raghu Ramakrishnan & Johannes Gehrke",
    "Seema Acharya"
];

// Mock course data
const mockCourse: Course = {
    id: "dbms",
    title: "Database Management Systems",
    description: "Complete DBMS course from syllabus",
    units: [
        {
            id: "u1",
            title: "Unit I: Introduction & ER Model",
            order: 1,
            subtopics: [
                { id: "relational_model", title: "Relational Data Model", difficulty: 2, textbook_reference: "Elmasri & Navathe" },
                { id: "sql_basics", title: "SQL Fundamentals", difficulty: 2, textbook_reference: "Raghu Ramakrishnan & Johannes Gehrke" },
            ]
        },
        {
            id: "u2",
            title: "Unit II: Relational Model & Algebra",
            order: 2,
            subtopics: [
                { id: "normalization_1nf", title: "First Normal Form (1NF)", difficulty: 3, textbook_reference: "Elmasri & Navathe" },
                { id: "normalization_2nf", title: "Second Normal Form (2NF)", difficulty: 3, textbook_reference: "Elmasri & Navathe" },
            ]
        },
    ]
};

export default function ContentManagerPage() {
    const [course, setCourse] = useState<Course>(mockCourse);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(null);
    const [showAddUnitModal, setShowAddUnitModal] = useState(false);
    const [showAddSubtopicModal, setShowAddSubtopicModal] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'unit' | 'subtopic', id: string } | null>(null);

    // Form state
    const [newUnitTitle, setNewUnitTitle] = useState("");
    const [newSubtopic, setNewSubtopic] = useState({ title: "", difficulty: 3, textbook_reference: TEXTBOOK_OPTIONS[0] });
    const [editContent, setEditContent] = useState("");

    const handleAddUnit = () => {
        if (!newUnitTitle.trim()) return;
        const newUnit: Unit = {
            id: `u${course.units.length + 1}`,
            title: newUnitTitle,
            order: course.units.length + 1,
            subtopics: []
        };
        setCourse({ ...course, units: [...course.units, newUnit] });
        setNewUnitTitle("");
        setShowAddUnitModal(false);
    };

    const handleAddSubtopic = () => {
        if (!selectedUnit || !newSubtopic.title.trim()) return;
        const subtopic: Subtopic = {
            id: `${selectedUnit.id}_s${selectedUnit.subtopics.length + 1}`,
            title: newSubtopic.title,
            difficulty: newSubtopic.difficulty,
            textbook_reference: newSubtopic.textbook_reference,
            content: ""
        };
        const updatedUnits = course.units.map(u =>
            u.id === selectedUnit.id
                ? { ...u, subtopics: [...u.subtopics, subtopic] }
                : u
        );
        setCourse({ ...course, units: updatedUnits });
        setNewSubtopic({ title: "", difficulty: 3, textbook_reference: TEXTBOOK_OPTIONS[0] });
        setShowAddSubtopicModal(false);
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        if (deleteTarget.type === 'unit') {
            setCourse({ ...course, units: course.units.filter(u => u.id !== deleteTarget.id) });
            if (selectedUnit?.id === deleteTarget.id) {
                setSelectedUnit(null);
                setSelectedSubtopic(null);
            }
        } else {
            const updatedUnits = course.units.map(u => ({
                ...u,
                subtopics: u.subtopics.filter(s => s.id !== deleteTarget.id)
            }));
            setCourse({ ...course, units: updatedUnits });
            if (selectedSubtopic?.id === deleteTarget.id) {
                setSelectedSubtopic(null);
            }
        }
        setShowDeleteDialog(false);
        setDeleteTarget(null);
    };

    const handleSaveContent = () => {
        if (!selectedUnit || !selectedSubtopic) return;
        const updatedUnits = course.units.map(u =>
            u.id === selectedUnit.id
                ? {
                    ...u,
                    subtopics: u.subtopics.map(s =>
                        s.id === selectedSubtopic.id ? { ...s, content: editContent } : s
                    )
                }
                : u
        );
        setCourse({ ...course, units: updatedUnits });
        const updated = updatedUnits.find(u => u.id === selectedUnit.id)?.subtopics.find(s => s.id === selectedSubtopic.id);
        if (updated) setSelectedSubtopic(updated);
    };

    return (
        <div className="min-h-screen bg-[#f2f4f6] flex flex-col md:flex-row font-sans">
            {/* Sidebar - Course Tree */}
            <aside className="w-full md:w-80 border-r border-slate-200 bg-white overflow-y-auto flex flex-col h-[50vh] md:h-screen">
                <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Link href="/teacher/dashboard">
                            <NeuralIconButton icon={ChevronLeft} />
                        </Link>
                        <h1 className="font-bold text-slate-900">Content Manager</h1>
                        <div className="ml-auto md:hidden">
                            <MobileSidebar />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-teal-600" />
                            <span className="font-medium text-slate-800">{course.title}</span>
                        </div>
                        <NeuralIconButton icon={Plus} onClick={() => setShowAddUnitModal(true)} size="sm" />
                    </div>
                </div>

                {/* Unit Tree */}
                <div className="p-2 flex-1 overflow-y-auto">
                    {course.units.map((unit) => (
                        <div key={unit.id} className="mb-2">
                            <button
                                onClick={() => setSelectedUnit(unit)}
                                className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition-colors font-medium
                                    ${selectedUnit?.id === unit.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <FolderOpen className={`h-4 w-4 shrink-0 ${selectedUnit?.id === unit.id ? 'text-amber-500 fill-amber-50' : 'text-slate-400'}`} />
                                <span className="text-sm truncate flex-1">{unit.title}</span>
                                <ChevronRight className={`h-4 w-4 transition-transform text-slate-300 ${selectedUnit?.id === unit.id ? 'rotate-90' : ''}`} />
                            </button>

                            {selectedUnit?.id === unit.id && (
                                <div className="ml-6 mt-1 space-y-1">
                                    {unit.subtopics.map((subtopic) => (
                                        <button
                                            key={subtopic.id}
                                            onClick={() => {
                                                setSelectedSubtopic(subtopic);
                                                setEditContent(subtopic.content || "");
                                            }}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm
                                                ${selectedSubtopic?.id === subtopic.id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <FileText className={`h-3.5 w-3.5 shrink-0 ${selectedSubtopic?.id === subtopic.id ? 'text-teal-500' : 'text-slate-300'}`} />
                                            <span className="truncate flex-1">{subtopic.title}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedSubtopic?.id === subtopic.id ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {subtopic.difficulty}/5
                                            </span>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setShowAddSubtopicModal(true)}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-slate-50 transition-colors text-sm text-slate-400 hover:text-teal-600 group"
                                    >
                                        <Plus className="h-3.5 w-3.5 group-hover:bg-teal-100 rounded-full" />
                                        <span>Add Subtopic</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content - Editor */}
            <main className="flex-1 overflow-y-auto h-[50vh] md:h-screen bg-[#f2f4f6]">
                {selectedSubtopic ? (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900">{selectedSubtopic.title}</h2>
                                <p className="text-sm text-slate-500">
                                    {selectedUnit?.title} • Difficulty: {selectedSubtopic.difficulty}/5
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <NeuralButton
                                    variant="glass"
                                    className="text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                        setDeleteTarget({ type: 'subtopic', id: selectedSubtopic.id });
                                        setShowDeleteDialog(true);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </NeuralButton>
                                <NeuralButton variant="primary" onClick={handleSaveContent}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </NeuralButton>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="mb-6 bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Metadata</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Textbook Reference</label>
                                    <p className="font-medium text-slate-700">{selectedSubtopic.textbook_reference || 'Not set'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Difficulty Level</label>
                                    <p className="font-medium text-slate-700 flex items-center gap-2">
                                        <span className="text-teal-600 font-bold text-lg">{selectedSubtopic.difficulty}</span>
                                        <span className="text-slate-400 text-sm">/ 5</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content Editor */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 flex flex-col h-[500px]">
                            <div className="mb-4 border-b border-slate-100 pb-2">
                                <h3 className="text-sm font-bold text-slate-900">Lesson Content</h3>
                                <p className="text-xs text-slate-500">Write lesson content in Markdown format</p>
                            </div>
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Enter lesson content here... Supports Markdown."
                                className="w-full flex-1 p-4 rounded-xl border border-slate-100 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-teal-100 focus:bg-white transition-all text-slate-700 font-mono text-sm leading-relaxed"
                            />
                        </div>
                    </div>
                ) : selectedUnit ? (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{selectedUnit.title}</h2>
                                <p className="text-sm text-slate-500">{selectedUnit.subtopics.length} subtopics</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <NeuralButton
                                    variant="glass"
                                    className="text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                        setDeleteTarget({ type: 'unit', id: selectedUnit.id });
                                        setShowDeleteDialog(true);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Unit
                                </NeuralButton>
                                <NeuralButton variant="ghost" className="bg-white" onClick={() => setShowAddSubtopicModal(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Subtopic
                                </NeuralButton>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Subtopics</h3>
                            <div className="space-y-3">
                                {selectedUnit.subtopics.map((subtopic, index) => (
                                    <div
                                        key={subtopic.id}
                                        className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer bg-slate-50/50 group"
                                        onClick={() => {
                                            setSelectedSubtopic(subtopic);
                                            setEditContent(subtopic.content || "");
                                        }}
                                    >
                                        <GripVertical className="h-4 w-4 text-slate-300" />
                                        <span className="text-sm font-bold text-slate-400 w-6">{index + 1}.</span>
                                        <span className="flex-1 font-bold text-slate-700 group-hover:text-teal-700 transition-colors">{subtopic.title}</span>
                                        <NeuralBadge variant="secondary">{subtopic.difficulty}/5</NeuralBadge>
                                        <NeuralIconButton icon={Edit} size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                                {selectedUnit.subtopics.length === 0 && (
                                    <div className="text-center py-10 text-slate-400">
                                        <p>No subtopics yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FolderOpen className="w-16 h-16 mb-4 text-slate-200" />
                        <p className="font-medium">Select a unit or subtopic to edit</p>
                    </div>
                )}
            </main>

            {/* Add Unit Modal */}
            <Modal
                open={showAddUnitModal}
                onClose={() => setShowAddUnitModal(false)}
                title="Add New Unit"
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Unit Title</label>
                        <input
                            value={newUnitTitle}
                            onChange={(e) => setNewUnitTitle(e.target.value)}
                            placeholder="e.g., Unit III: SQL & Relational Design"
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <NeuralButton variant="ghost" onClick={() => setShowAddUnitModal(false)}>Cancel</NeuralButton>
                        <NeuralButton variant="primary" onClick={handleAddUnit}>Add Unit</NeuralButton>
                    </div>
                </div>
            </Modal>

            {/* Add Subtopic Modal */}
            <Modal
                open={showAddSubtopicModal}
                onClose={() => setShowAddSubtopicModal(false)}
                title="Add New Subtopic"
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Subtopic Title</label>
                        <input
                            value={newSubtopic.title}
                            onChange={(e) => setNewSubtopic({ ...newSubtopic, title: e.target.value })}
                            placeholder="e.g., ACID Properties"
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Difficulty (1-5)</label>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={newSubtopic.difficulty}
                            onChange={(e) => setNewSubtopic({ ...newSubtopic, difficulty: parseInt(e.target.value) || 3 })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">Textbook Reference</label>
                        <select
                            value={newSubtopic.textbook_reference}
                            onChange={(e) => setNewSubtopic({ ...newSubtopic, textbook_reference: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        >
                            {TEXTBOOK_OPTIONS.map((book) => (
                                <option key={book} value={book}>{book}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <NeuralButton variant="ghost" onClick={() => setShowAddSubtopicModal(false)}>
                            Cancel
                        </NeuralButton>
                        <NeuralButton variant="primary" onClick={handleAddSubtopic}>
                            Add Subtopic
                        </NeuralButton>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setDeleteTarget(null);
                }}
                onConfirm={handleDelete}
                title={deleteTarget ? `Delete ${deleteTarget.type === 'unit' ? 'Unit' : 'Subtopic'}?` : "Delete Item?"}
                message="This action cannot be undone. All content will be permanently deleted."
                confirmText="Delete"
                danger={true}
            />
        </div>
    );
}
