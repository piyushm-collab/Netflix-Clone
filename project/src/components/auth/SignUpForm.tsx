import React from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../../lib/apiClient';
import FormField from '../ui/FormField';
import { ChevronRight } from 'lucide-react';
import './Auth.css';

const SignUpSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required'),
  email: Yup.string().email('Please enter a valid email').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Passwords must match').required('Please confirm your password'),
});

const SignUpForm: React.FC = () => {
  const handleSubmit = async (
    values: { fullName: string; email: string; password: string; confirmPassword: string },
    { setSubmitting }: { setSubmitting: (v: boolean) => void }
  ) => {
    try {
      const { data } = await apiClient.post('/auth/register', {
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      });
      localStorage.setItem('netflix_token', data.token);
      localStorage.setItem('netflix_user', JSON.stringify(data.user));
      toast.success('Account created! Welcome to Netflix.');
      window.location.href = '/browse';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to sign up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="form-container glass-effect"
    >
      <h1 className="text-3xl font-bold mb-2">Sign Up</h1>
      <p className="text-netflix-light-gray mb-8">Create your Netflix account to start watching</p>

      <Formik
        initialValues={{ fullName: '', email: '', password: '', confirmPassword: '' }}
        validationSchema={SignUpSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form className="space-y-4">
            <FormField name="fullName" label="Full Name" type="text" />
            <FormField name="email" label="Email" type="email" />
            <FormField name="password" label="Password" type="password" />
            <FormField name="confirmPassword" label="Confirm Password" type="password" />
            <button type="submit" disabled={isSubmitting} className="btn btn-red btn-xl w-full mt-8 flex items-center justify-center">
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Sign Up <ChevronRight size={20} className="ml-1" /></>
              )}
            </button>
          </Form>
        )}
      </Formik>

      <div className="mt-16 text-netflix-light-gray">
        <p>Already have an account?{' '}<Link to="/signin" className="text-white hover:underline">Sign in</Link></p>
        <p className="mt-4 text-sm">This page is protected by Google reCAPTCHA to ensure you're not a bot.</p>
      </div>
    </motion.div>
  );
};

export default SignUpForm;
